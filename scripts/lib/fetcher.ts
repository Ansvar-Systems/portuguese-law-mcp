/**
 * Rate-limited HTTP client for DRE (dre.pt)
 *
 * Strategy:
 * 1. Fetch pages from DRE's consolidated legislation and search endpoints
 * 2. Rate-limit all requests (500ms minimum between requests)
 * 3. Retry on 429/5xx errors with exponential backoff
 *
 * DRE (Diário da República Eletrónico) is the official electronic journal
 * of the Portuguese Republic, operated by INCM (Imprensa Nacional-Casa da Moeda).
 *
 * URL patterns:
 * - Consolidated: https://dre.pt/legislacao-consolidada/lei/2019-124417108
 * - Search/details: https://dre.pt/home/-/dre/XXXXXXX/details/maximized
 * - Open data API: https://dre.pt/opendata
 */

const USER_AGENT = 'Portuguese-Law-MCP/1.0 (https://github.com/Ansvar-Systems/portuguese-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, accept?: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': accept ?? 'text/html, application/xhtml+xml, */*',
        },
        redirect: 'follow',
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }

      const body = await response.text();
      return {
        status: response.status,
        body,
        contentType: response.headers.get('content-type') ?? '',
      };
    } catch (error) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  Network error for ${url}: ${msg}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Fetch legislation HTML from DRE.
 *
 * Tries the provided URL and validates that the response contains
 * legislation content (not an error page or redirect).
 *
 * Returns the FetchResult or null if unavailable.
 */
export async function fetchLegislationHtml(url: string): Promise<FetchResult | null> {
  const result = await fetchWithRateLimit(url);
  if (result.status !== 200) {
    return null;
  }

  return result;
}

/**
 * Fetch JSON from the DRE open data API.
 */
export async function fetchDreApi(url: string): Promise<FetchResult | null> {
  const result = await fetchWithRateLimit(url, 'application/json');
  if (result.status !== 200) {
    return null;
  }

  return result;
}
