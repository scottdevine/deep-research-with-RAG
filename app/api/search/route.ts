import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { CONFIG } from '@/lib/config'
import { searchPubMed } from '@/lib/pubmed'

// Define the Google Custom Search API endpoint
const GOOGLE_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1'

// Define the Bing Search API endpoint
const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search'

// Define the Exa Search API endpoint
const EXA_ENDPOINT = 'https://api.exa.ai/search'

// Define the time filter type
type TimeFilter =
  | 'day'
  | 'week'
  | 'month'
  | '6months'
  | '12months'
  | '5years'
  | '10years'
  | 'all'

// Helper function to convert time filter to Bing freshness parameter
function getBingFreshness(timeFilter: TimeFilter): string | null {
  switch (timeFilter) {
    case 'day':
      return 'Day'
    case 'week':
      return 'Week'
    case 'month':
      return 'Month'
    case '6months':
      return 'Month'
    case '12months':
      return 'Year'
    case '5years':
      return 'Year'
    case '10years':
      return 'Year'
    case 'all':
      return null
    default:
      return 'Month' // Default to month if not specified
  }
}

// Helper function to convert time filter to Google dateRestrict parameter
function getGoogleDateRestrict(timeFilter: TimeFilter): string | null {
  switch (timeFilter) {
    case 'day':
      return 'd1'
    case 'week':
      return 'w1'
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
      return 'm1' // Default to month if not specified
  }
}

export async function POST(request: Request) {
  try {
    console.log('=== SEARCH API CALLED ===');
    const body = await request.json()
    console.log('Request body:', body);
    const {
      query,
      timeFilter = 'all',
      provider = 'google',
      fetchAll = false,
      includePubMed = false,
    } = body

    // Check if this is a test query
    const isTestQuery = query.toLowerCase().includes('test query')

    // Use Google Custom Search API
    if (provider === 'google' || provider === 'exa') {
      // Google search implementation
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

      // Determine how many results to fetch
      const maxResults = fetchAll ? 50 : CONFIG.search.resultsPerPage;
      const googleResults = [];
      
      // Fetch multiple pages of Google results if fetchAll is true
      if (fetchAll) {
        console.log(`Fetching up to ${maxResults} Google results for query: "${query}"`);
        
        // Google API allows a maximum of 10 results per request, so we need to make multiple requests
        const maxPages = Math.ceil(maxResults / 10);
        
        for (let page = 1; page <= maxPages; page++) {
          const startIndex = (page - 1) * 10 + 1;
          
          const params = new URLSearchParams({
            q: query,
            key: googleApiKey,
            cx: googleCx,
            num: '10', // Google API maximum is 10 per request
            start: startIndex.toString(),
          });
          
          // Add date restriction if a time filter is applied
          const dateRestrict = getGoogleDateRestrict(timeFilter as TimeFilter)
          if (dateRestrict) {
            params.append('dateRestrict', dateRestrict)
          }
          
          // Add safe search parameter
          params.append('safe', CONFIG.search.safeSearch.google)
          
          console.log(`Fetching Google results page ${page} (startIndex: ${startIndex})`);
          
          try {
            const googleResponse = await fetch(
              `${GOOGLE_ENDPOINT}?${params.toString()}`
            );
            
            if (!googleResponse.ok) {
              if (googleResponse.status === 429) {
                console.error('Google Search API rate limit exceeded:', {
                  status: googleResponse.status,
                  headers: Object.fromEntries(googleResponse.headers.entries()),
                  query,
                  timeFilter,
                });
                
                break; // Stop fetching more pages
              }
              
              console.error(`Error fetching Google results page ${page}:`, googleResponse.status);
              break; // Stop fetching more pages
            }
            
            const data = await googleResponse.json();
            
            // Transform and add results to our array
            const pageResults = data.items?.map((item: any) => ({
              id: item.link,
              name: item.title,
              url: item.link,
              snippet: item.snippet,
              source: 'google',
              isPubMed: false,
            })) || [];
            
            googleResults.push(...pageResults);
            
            // If we didn't get a full page of results, we've reached the end
            if (pageResults.length < 10) {
              break;
            }
            
            // If we've reached our maximum, stop fetching
            if (googleResults.length >= maxResults) {
              break;
            }
          } catch (error) {
            console.error(`Error fetching Google results page ${page}:`, error);
            break; // Stop fetching more pages
          }
        }
        
        console.log(`Fetched ${googleResults.length} total Google results`);
      } else {
        // Original single-page fetch logic
        const params = new URLSearchParams({
          q: query,
          key: googleApiKey,
          cx: googleCx,
          num: CONFIG.search.resultsPerPage.toString(),
          start: '1',
        });
        
        // Add date restriction if a time filter is applied
        const dateRestrict = getGoogleDateRestrict(timeFilter as TimeFilter)
        if (dateRestrict) {
          params.append('dateRestrict', dateRestrict)
        }
        
        // Add safe search parameter
        params.append('safe', CONFIG.search.safeSearch.google)
        
        const googleResponse = await fetch(
          `${GOOGLE_ENDPOINT}?${params.toString()}`
        );
        
        if (!googleResponse.ok) {
          if (googleResponse.status === 429) {
            console.error('Google Search API rate limit exceeded:', {
              status: googleResponse.status,
              headers: Object.fromEntries(googleResponse.headers.entries()),
              query,
              timeFilter,
            });
            
            try {
              const errorBody = await googleResponse.json()
              console.error('Google Error Response:', errorBody)
            } catch (e) {
              console.error('Could not parse Google error response', e)
            }
            
            return NextResponse.json(
              {
                error:
                  'Search rate limit exceeded. Please try again later or reduce the frequency of searches.',
              },
              { status: 429 }
            );
          }
          
          const errorData = await googleResponse.json().catch(() => null)
          return NextResponse.json(
            {
              error:
                errorData?.error?.message ||
                `Search API returned error ${googleResponse.status}`,
            },
            { status: googleResponse.status }
          );
        }
        
        const data = await googleResponse.json();
        
        // Transform Google results to match our format
        googleResults.push(...(data.items?.map((item: any) => ({
          id: item.link,
          name: item.title,
          url: item.link,
          snippet: item.snippet,
          source: 'google',
          isPubMed: false,
        })) || []));
      }

      // Handle PubMed search if requested
      let pubmedResults = [];
      
      // Always try a direct PubMed test search for debugging
      try {
        console.log('Performing direct PubMed test search for "cancer"');
        const testResults = await searchPubMed('cancer', 3);
        console.log(`Direct PubMed test returned ${testResults.length} results`);
        if (testResults.length > 0) {
          console.log('First test result:', JSON.stringify(testResults[0], null, 2));
        }
      } catch (error) {
        console.error('Direct PubMed test search failed:', error);
      }
      
      if (includePubMed && !isTestQuery) {
        try {
          console.log(`Requesting PubMed results for query: "${query}" (includePubMed=${includePubMed})`);
          
          // Extract key terms for PubMed search
          const keyTerms = extractKeyTermsForPubMed(query);
          console.log(`Extracted key terms for PubMed: "${keyTerms}"`);
          
          // Determine how many PubMed results to fetch
          const pubmedMaxResults = fetchAll ? 50 : CONFIG.search.resultsPerPage;
          
          // Get PubMed results with the simplified query
          pubmedResults = await searchPubMed(keyTerms, pubmedMaxResults);
          console.log(`Found ${pubmedResults.length} PubMed results for query: "${query}"`);

          if (pubmedResults.length > 0) {
            console.log('First PubMed result:', JSON.stringify(pubmedResults[0], null, 2));
          } else {
            console.log('No PubMed results found');
          }
        } catch (error) {
          console.error('Error fetching PubMed results:', error);
          // Continue with Google results even if PubMed fails
        }
      }

      // Combine Google and PubMed results
      const allCombinedResults = [...googleResults, ...pubmedResults];
      console.log(`Combined ${googleResults.length} Google results with ${pubmedResults.length} PubMed results`);
      
      // Calculate total results and pages for client-side pagination
      const totalResults = allCombinedResults.length;
      const totalPages = Math.ceil(totalResults / CONFIG.search.resultsPerPage);
      
      const transformedResults = {
        webPages: {
          value: allCombinedResults,
        },
        // Add pagination information for client-side use
        pagination: {
          currentPage: 1,
          totalPages,
          totalResults,
        },
        // Add flag to indicate PubMed results are included
        hasPubMedResults: includePubMed && pubmedResults.length > 0,
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

      // Determine how many results to fetch
      const maxResults = fetchAll ? 50 : CONFIG.search.resultsPerPage;
      
      const params = new URLSearchParams({
        q: query,
        count: maxResults.toString(),
        offset: '0', // Start from the beginning
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

      // Add pagination information for client-side use
      const totalResults = data.webPages?.value?.length || 0;
      const totalPages = Math.ceil(totalResults / CONFIG.search.resultsPerPage);

      // Add pagination information to the response
      const responseWithPagination = {
        ...data,
        pagination: {
          currentPage: 1,
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

// Helper function to extract key terms from a query for PubMed search and convert to MeSH terms
function extractKeyTermsForPubMed(query: string): string {
  // For simple medical queries, convert directly to MeSH terms
  const lowerQuery = query.toLowerCase();

  // Check for specific medical topics and use appropriate MeSH terms
  if (lowerQuery.includes('cancer')) {
    if (lowerQuery.includes('breast cancer')) {
      return '"Breast Neoplasms"[MeSH]';
    } else if (lowerQuery.includes('lung cancer')) {
      return '"Lung Neoplasms"[MeSH]';
    } else if (lowerQuery.includes('prostate cancer')) {
      return '"Prostatic Neoplasms"[MeSH]';
    } else if (lowerQuery.includes('research')) {
      return '"Neoplasms"[MeSH] AND "Research"[MeSH]';
    } else {
      return '"Neoplasms"[MeSH]';
    }
  }

  if (lowerQuery.includes('diabetes')) {
    if (lowerQuery.includes('type 2') || lowerQuery.includes('type ii')) {
      return '"Diabetes Mellitus, Type 2"[MeSH]';
    } else if (lowerQuery.includes('type 1') || lowerQuery.includes('type i')) {
      return '"Diabetes Mellitus, Type 1"[MeSH]';
    } else {
      return '"Diabetes Mellitus"[MeSH]';
    }
  }

  if (lowerQuery.includes('covid') || lowerQuery.includes('coronavirus')) {
    return '"COVID-19"[MeSH]';
  }

  // Special case for 340b program
  if (lowerQuery.includes('340b')) {
    return '"Drug Costs"[MeSH] AND "Pharmaceutical Services"[MeSH] AND 340b';
  }

  // For other queries, extract key terms and try to map to MeSH
  // Remove common phrases that make the query too specific
  let simplified = query.replace(/I am interested in|I want to know about|Please tell me about|Can you find information on|latest research on/gi, '');

  // Remove filler words but keep important medical terms
  const fillerWords = /\b(the|and|or|of|in|on|to|for|a|an|is|are|that|this|these|those|with|by|as|at|from|about)\b/gi;
  simplified = simplified.replace(fillerWords, ' ');

  // Extract potential medical/scientific terms
  const words = simplified.split(/\s+/).filter(word => word.length > 2);

  // Map common terms to MeSH terms
  const meshMappings: Record<string, string> = {
    'drug': '"Pharmaceutical Preparations"[MeSH]',
    'drugs': '"Pharmaceutical Preparations"[MeSH]',
    'medicine': '"Medicine"[MeSH]',
    'treatment': '"Therapeutics"[MeSH]',
    'therapy': '"Therapeutics"[MeSH]',
    'disease': '"Disease"[MeSH]',
    'health': '"Health"[MeSH]',
    'clinical': '"Clinical Study"[Publication Type]',
    'trial': '"Clinical Trial"[Publication Type]',
    'research': '"Research"[MeSH]',
    'pharmaceutical': '"Pharmaceutical Preparations"[MeSH]',
    'pharma': '"Pharmaceutical Industry"[MeSH]',
    'discount': '"Economics, Pharmaceutical"[MeSH]',
    'program': '"Programs"[MeSH]',
  };

  // Convert words to MeSH terms when possible
  const meshTerms = words.map(word => {
    const lowerWord = word.toLowerCase();
    return meshMappings[lowerWord] || word;
  });

  // Join terms with AND operator for better PubMed search
  return meshTerms.join(' AND ') || query.trim();
}
