import { NextResponse } from 'next/server'
import { searchRatelimit } from '@/lib/redis'
import { CONFIG } from '@/lib/config'

const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search'
const GOOGLE_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1'
const EXA_ENDPOINT = 'https://api.exa.ai/search'

type TimeFilter = 'month' | '6months' | '12months' | '5years' | '10years' | 'all'

function getBingFreshness(timeFilter: TimeFilter): string {
  switch (timeFilter) {
    case 'month':
      return 'Month'
    case '6months':
      // Bing doesn't have a 6-month option, so we use Month
      return 'Month'
    case '12months':
      return 'Year'
    case '5years':
      // Bing only has up to Year, so we default to no freshness filter
      return ''
    case '10years':
      // Bing only has up to Year, so we default to no freshness filter
      return ''
    case 'all':
      return ''
    default:
      return ''
  }
}

function getGoogleDateRestrict(timeFilter: TimeFilter): string | null {
  // Map our timeFilter to Google's dateRestrict values
  // Google uses format [type][number] where type is d/w/m/y and number is the count
  switch (timeFilter) {
    case 'month':
      return 'm1'
    case '6months':
      return 'm6'
    case '12months':
      return 'y1'
    case '5years':
      return 'y5'
    case '10years':
      return 'y10'
    case 'all':
      return null
    default:
      return null
  }
}

function getExaRecency(timeFilter: TimeFilter): string {
  // Map our timeFilter to Exa's recency values
  switch (timeFilter) {
    case 'month':
      return 'month'
    case '6months':
      return 'months' // Exa supports 'months' which is typically 6 months
    case '12months':
      return 'year'
    case '5years':
      return 'years' // Exa supports 'years' which is typically 5-10 years
    case '10years':
      return 'years'
    case 'all':
      return 'all'
    default:
      return 'month' // Default to month if not specified
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      query,
      timeFilter = 'all',
      provider = CONFIG.search.provider,
      isTestQuery = false,
      page = 1, // Add pagination support
    } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Return dummy results for test queries
    if (query.toLowerCase() === 'test' || isTestQuery) {
      return NextResponse.json({
        webPages: {
          value: [
            {
              id: 'test-1',
              url: 'https://example.com/test-1',
              name: 'Test Result 1',
              snippet:
                'This is a test search result for testing purposes. It contains some sample text about research and analysis.',
            },
            {
              id: 'test-2',
              url: 'https://example.com/test-2',
              name: 'Test Result 2',
              snippet:
                'Another test result with different content. This one discusses methodology and data collection.',
            },
            {
              id: 'test-3',
              url: 'https://example.com/test-3',
              name: 'Test Result 3',
              snippet:
                'A third test result focusing on academic research and scientific papers.',
            },
          ],
        },
      })
    }

    // Only check rate limit if enabled
    if (CONFIG.rateLimits.enabled) {
      const { success } = await searchRatelimit.limit(query)
      if (!success) {
        return NextResponse.json(
          {
            error:
              'Too many requests. Please wait a moment before trying again.',
          },
          { status: 429 }
        )
      }
    }

    if (provider === 'exa') {
      const exaApiKey = process.env.EXA_API_KEY
      if (!exaApiKey) {
        return NextResponse.json(
          {
            error:
              'Exa search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      try {
        const exaResponse = await fetch(EXA_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${exaApiKey}`,
          },
          body: JSON.stringify({
            query,
            type: 'auto',
            numResults: CONFIG.search.resultsPerPage,
            // Add pagination for Exa API
            offset: (page - 1) * CONFIG.search.resultsPerPage,
            contents: {
              text: {
                maxCharacters: 500,
              },
            },
            // Add time filter for Exa API
            ...(timeFilter !== 'all' && {
              recency: getExaRecency(timeFilter as TimeFilter),
            }),
          }),
        })

        if (!exaResponse.ok) {
          if (exaResponse.status === 429) {
            return NextResponse.json(
              {
                error: 'Rate limit exceeded. Please try again later.',
              },
              { status: 429 }
            )
          }
          throw new Error(`Exa API error: ${exaResponse.status}`)
        }

        const response = await exaResponse.json()

        if (!response?.results) {
          throw new Error('Unexpected Exa API response format')
        }

        // Transform Exa results to match our format
        const totalResults = response.totalCount || response.results.length
        const totalPages = Math.ceil(totalResults / CONFIG.search.resultsPerPage)

        const transformedResults = {
          webPages: {
            value: response.results.map((item: any) => ({
              id: item.id || item.url,
              url: item.url,
              name: item.title || 'Untitled',
              snippet: item.text || '',
              publishedDate: item.publishedDate || undefined,
              author: item.author || undefined,
              image: item.image || undefined,
              favicon: item.favicon || undefined,
              score: item.score || undefined,
            })),
          },
          // Add pagination information
          pagination: {
            currentPage: page,
            totalPages,
            totalResults,
          }
        }

        return NextResponse.json(transformedResults)
      } catch (error: any) {
        console.error('Exa search error:', error)
        return NextResponse.json(
          {
            error: 'Failed to fetch search results from Exa.',
          },
          { status: 500 }
        )
      }
    } else if (provider === 'google') {
      // Ensure required Google API variables are available.
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY
      const googleCx = process.env.GOOGLE_SEARCH_CX
      if (!googleApiKey || !googleCx) {
        return NextResponse.json(
          {
            error:
              'Google search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      // Calculate start index for pagination (1-based index)
      const startIndex = ((page - 1) * CONFIG.search.resultsPerPage) + 1

      const params = new URLSearchParams({
        q: query,
        key: googleApiKey,
        cx: googleCx,
        num: CONFIG.search.resultsPerPage.toString(),
        start: startIndex.toString(), // Add pagination parameter
      })

      // Add Google's dateRestrict parameter if a time filter is applied
      const dateRestrict = getGoogleDateRestrict(timeFilter as TimeFilter)
      if (dateRestrict) {
        params.append('dateRestrict', dateRestrict)
      }

      // Set safe search parameter based on config
      params.append('safe', CONFIG.search.safeSearch.google)

      const googleResponse = await fetch(
        `${GOOGLE_ENDPOINT}?${params.toString()}`
      )

      if (!googleResponse.ok) {
        const errorData = await googleResponse.json().catch(() => null)

        // Check for quota exceeded error
        if (errorData?.error?.message?.includes('Quota exceeded')) {
          return NextResponse.json(
            {
              error:
                'Daily search limit reached. Please try again tomorrow or contact support for increased limits.',
            },
            { status: 429 }
          )
        }

        return NextResponse.json(
          {
            error:
              'An error occurred while fetching search results. Please try again later.',
          },
          { status: googleResponse.status }
        )
      }

      const data = await googleResponse.json()

      // Calculate total results and pages
      const totalResults = data.searchInformation?.totalResults ? parseInt(data.searchInformation.totalResults) : 0
      const totalPages = Math.ceil(totalResults / CONFIG.search.resultsPerPage)

      // Transform Google search results to match our format
      const transformedResults = {
        webPages: {
          value:
            data.items?.map((item: any) => ({
              id: item.cacheId || item.link,
              url: item.link,
              name: item.title,
              snippet: item.snippet,
            })) || [],
        },
        // Add pagination information
        pagination: {
          currentPage: page,
          totalPages,
          totalResults,
        }
      }

      return NextResponse.json(transformedResults)
    } else {
      // Default to Bing search
      const subscriptionKey = process.env.AZURE_SUB_KEY
      if (!subscriptionKey) {
        return NextResponse.json(
          {
            error:
              'Search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      // Calculate offset for pagination
      const offset = (page - 1) * CONFIG.search.resultsPerPage

      const params = new URLSearchParams({
        q: query,
        count: CONFIG.search.resultsPerPage.toString(),
        offset: offset.toString(), // Add pagination parameter
        mkt: CONFIG.search.market,
        safeSearch: CONFIG.search.safeSearch.bing,
        textFormat: 'HTML',
        textDecorations: 'true',
      })

      // Add freshness parameter for Bing if a time filter is applied
      const freshness = getBingFreshness(timeFilter as TimeFilter)
      if (freshness) {
        params.append('freshness', freshness)
      }

      const bingResponse = await fetch(
        `${BING_ENDPOINT}?${params.toString()}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Accept-Language': 'en-US',
          },
        }
      )

      if (!bingResponse.ok) {
        if (bingResponse.status === 403) {
          console.error('Bing Search API 403 Error:', {
            status: bingResponse.status,
            headers: Object.fromEntries(bingResponse.headers.entries()),
            query,
            timeFilter,
          })

          try {
            const errorBody = await bingResponse.json()
            console.error('Bing Error Response:', errorBody)
          } catch (e) {
            console.error('Could not parse Bing error response', e)
          }

          return NextResponse.json(
            {
              error:
                'Monthly search quota exceeded. Please try again next month or contact support for increased limits.',
            },
            { status: 403 }
          )
        }
        const errorData = await bingResponse.json().catch(() => null)
        return NextResponse.json(
          {
            error:
              errorData?.message ||
              `Search API returned error ${bingResponse.status}`,
          },
          { status: bingResponse.status }
        )
      }

      const data = await bingResponse.json()

      // Add pagination information to Bing response
      const totalResults = data.webPages?.totalEstimatedMatches || 0
      const totalPages = Math.ceil(totalResults / CONFIG.search.resultsPerPage)

      // Add pagination information to the response
      const responseWithPagination = {
        ...data,
        pagination: {
          currentPage: page,
          totalPages,
          totalResults,
        }
      }

      return NextResponse.json(responseWithPagination)
    }
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while fetching search results',
      },
      { status: 500 }
    )
  }
}
