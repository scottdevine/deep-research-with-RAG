import { SearchResult } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { XMLParser } from 'fast-xml-parser'

const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const PUBMED_API_KEY = process.env.PUBMED_API_KEY
const PUBMED_API_EMAIL = process.env.PUBMED_API_EMAIL

// XML parser options
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
}

const parser = new XMLParser(parserOptions)

// For debugging, log the API key and email (partially masked)
if (PUBMED_API_KEY) {
  const maskedKey = PUBMED_API_KEY.substring(0, 4) + '...' + PUBMED_API_KEY.substring(PUBMED_API_KEY.length - 4)
  console.log(`PubMed API Key configured: ${maskedKey}`)
} else {
  console.warn('PubMed API Key not configured')
}

if (PUBMED_API_EMAIL) {
  console.log(`PubMed API Email configured: ${PUBMED_API_EMAIL}`)
} else {
  console.warn('PubMed API Email not configured')
}

/**
 * Search PubMed for articles matching the query
 */
// Helper function to add delay for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry a function with exponential backoff
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries) throw error;

      // If it's a rate limit error (429), wait longer
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const waitTime = isRateLimit ?
        Math.pow(2, retries + 1) * 1000 + Math.random() * 1000 : // 2s, 4s, 8s for rate limits
        Math.pow(2, retries) * 500 + Math.random() * 500;       // 500ms, 1s, 2s for other errors

      console.log(`Retrying PubMed API call in ${waitTime}ms (retry ${retries + 1}/${maxRetries})`);
      await delay(waitTime);
      retries++;
    }
  }
}

export async function searchPubMed(query: string, maxResults = 10): Promise<SearchResult[]> {
  try {
    console.log(`PubMed search started for query: "${query}" with max results: ${maxResults}`);
    console.log('PubMed API Key:', PUBMED_API_KEY ? 'Present (masked)' : 'Not present');
    console.log('PubMed API Email:', PUBMED_API_EMAIL ? 'Present (masked)' : 'Not present');

    // Make sure we have a valid query
    if (!query || query.trim().length < 2) {
      console.log('Query too short for PubMed search');
      return [];
    }

    // Step 1: Search for PMIDs with retry logic
    const searchUrl = `${PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
    console.log(`PubMed search URL: ${searchUrl}`);

    const searchData = await retryWithBackoff(async () => {
      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        throw new Error(`PubMed search failed: ${searchResponse.status}`);
      }

      return searchResponse.json();
    });

    // Extract PMIDs
    const pmids = searchData.esearchresult?.idlist || [];
    console.log(`Found ${pmids.length} PMIDs for query: "${query}"`);

    if (pmids.length === 0) {
      return [];
    }

    // Step 2: Get summaries for these PMIDs with retry logic
    // Process in smaller batches to avoid rate limiting
    const BATCH_SIZE = 5;
    let allResults: SearchResult[] = [];

    // Process PMIDs in batches
    for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
      const batchPmids = pmids.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} with ${batchPmids.length} PMIDs`);

      const summaryUrl = `${PUBMED_BASE_URL}/esummary.fcgi?db=pubmed&id=${batchPmids.join(',')}&retmode=json`;
      console.log(`PubMed summary URL: ${summaryUrl}`);

      try {
        const summaryData = await retryWithBackoff(async () => {
          const summaryResponse = await fetch(summaryUrl);

          if (!summaryResponse.ok) {
            throw new Error(`PubMed summary fetch failed: ${summaryResponse.status}`);
          }

          return summaryResponse.json();
        });

        // Process this batch of results
        for (const pmid of batchPmids) {
          try {
            const article = summaryData.result[pmid];
            if (!article) continue;

            // Extract basic metadata
            const title = article.title || 'No title available';
            let authorText = '';

            if (article.authors && article.authors.length > 0) {
              const authorNames = article.authors.map((a: any) => a.name).slice(0, 3);
              authorText = authorNames.join(', ');
              if (article.authors.length > 3) {
                authorText += ' et al.';
              }
            }

            const journal = article.fulljournalname || article.source || '';
            const pubDate = article.pubdate || '';

            // Create snippet with journal and publication date
            const snippet = `${authorText ? `${authorText}. ` : ''}${journal ? `${journal}. ` : ''}${pubDate ? `Published: ${pubDate}` : ''}`;

            // Create URL to PubMed article
            const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

            allResults.push({
              id: `pubmed-${uuidv4()}`,
              name: title,
              url,
              snippet,
              source: 'pubmed',
              isPubMed: true,
              pmid,
              journal,
              pubDate,
              authors: authorText ? authorText.split(', ') : [],
            });
          } catch (err) {
            console.error(`Error processing PubMed article ${pmid}:`, err);
          }
        }

        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < pmids.length) {
          await delay(500);
        }
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        // Continue with next batch even if this one failed
      }
    }

    console.log(`Created ${allResults.length} PubMed search results`);
    return allResults;
  } catch (error) {
    console.error('PubMed search error:', error);
    return [];
  }
}


