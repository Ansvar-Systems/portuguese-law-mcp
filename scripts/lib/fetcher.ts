/**
 * Rate-limited HTTP client for Portuguese legislation sources.
 *
 * Primary source: PGDL (Procuradoria-Geral Distrital de Lisboa) at pgdlisboa.pt
 * - Comprehensive consolidated legislation database
 * - Full-text article view via ficha=101 parameter
 * - Encoding: ISO-8859-1 (Latin-1)
 *
 * Secondary source: DRE (Diário da República Eletrónico) at dre.pt
 * - Official electronic journal, operated by INCM
 * - Currently an OutSystems SPA — direct HTML scraping not reliable
 *
 * Strategy:
 * 1. Rate-limit all requests (300ms minimum between requests)
 * 2. Retry on 429/5xx errors with exponential backoff
 * 3. Max 5 concurrent requests via semaphore
 */

const USER_AGENT = 'Portuguese-Law-MCP/2.0 (https://github.com/Ansvar-Systems/portuguese-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 300;
const MAX_CONCURRENT = 5;

let lastRequestTime = 0;
let activeFetches = 0;

async function rateLimit(): Promise<void> {
  // Wait for a slot in the concurrency pool
  while (activeFetches >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  activeFetches++;
}

function releaseSlot(): void {
  activeFetches = Math.max(0, activeFetches - 1);
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 *
 * For PGDL pages (ISO-8859-1 encoded), use the `latin1` option to properly
 * decode the response body before returning it as UTF-8.
 */
export async function fetchWithRateLimit(url: string, accept?: string, maxRetries = 3, latin1 = false): Promise<FetchResult> {
  await rateLimit();

  try {
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

        let body: string;
        if (latin1) {
          // Read as ArrayBuffer and decode as ISO-8859-1 -> UTF-8
          const buffer = await response.arrayBuffer();
          body = new TextDecoder('iso-8859-1').decode(buffer);
        } else {
          body = await response.text();
        }

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
  } finally {
    releaseSlot();
  }
}

/**
 * Fetch legislation full-text HTML from PGDL.
 *
 * PGDL serves pages in ISO-8859-1 (Latin-1) encoding.
 * The response body is returned as-is — caller must handle encoding.
 *
 * URL pattern:
 *   https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid={nid}&tabela=leis&ficha=101
 *
 * ficha=101 returns ALL articles of the law in a single page.
 */
export async function fetchPgdlFullText(nid: string): Promise<FetchResult | null> {
  // Use the print view which returns ALL articles in a single page
  const url = `https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=${nid}&nversao=`;
  const result = await fetchWithRateLimit(url, undefined, 3, true);

  if (result.status !== 200) {
    return null;
  }

  // Check for error pages
  if (result.body.includes('Erro') && result.body.includes('registo') && result.body.length < 5000) {
    return null;
  }

  return result;
}

/**
 * Fetch legislation HTML from DRE (legacy fallback).
 */
export async function fetchLegislationHtml(url: string): Promise<FetchResult | null> {
  const result = await fetchWithRateLimit(url);
  if (result.status !== 200) {
    return null;
  }

  return result;
}

/**
 * Fetch JSON from the DRE open data API (legacy fallback).
 */
export async function fetchDreApi(url: string): Promise<FetchResult | null> {
  const result = await fetchWithRateLimit(url, 'application/json');
  if (result.status !== 200) {
    return null;
  }

  return result;
}
