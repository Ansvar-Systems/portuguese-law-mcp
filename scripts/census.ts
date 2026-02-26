#!/usr/bin/env tsx
/**
 * Portuguese Law MCP — Census Script
 *
 * Enumerates ALL Portuguese legislation from the PGDL (Procuradoria-Geral
 * Distrital de Lisboa) database at pgdlisboa.pt, which maintains a comprehensive
 * catalogue of Portuguese consolidated legislation (~1,984 primary diplomas).
 *
 * Strategy:
 *   1. Scrape the paginated listing at /leis/lei_main.php
 *      Pagination uses ficha parameter: ficha=1, 101, 201, ..., 1901 (20 pages)
 *   2. Extract nid, title, legislation type/number, and category for each diploma
 *   3. Classify each as ingestable/inaccessible/metadata_only
 *   4. Write data/census.json in golden standard format
 *
 * PGDL provides structured HTML with full-text article views (ficha=101 parameter
 * on lei_mostra_articulado.php), making it the most practical source for bulk
 * ingestion of Portuguese law.
 *
 * The official source is DRE (dre.pt / Diário da República Eletrónico), operated
 * by INCM. However, DRE migrated to a Single-Page Application (OutSystems) that
 * cannot be scraped without a headless browser. PGDL mirrors consolidated DRE content.
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *
 * Data sourced under Portuguese open data terms.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const CENSUS_PATH = path.join(DATA_DIR, 'census.json');

const BASE_URL = 'https://www.pgdlisboa.pt/leis/lei_main.php';

// PGDL pagination: 20 pages, ficha=1,101,201,...,1901
const TOTAL_PAGES = 20;

interface CensusLaw {
  id: string;
  nid: string;
  title: string;
  citation: string;
  legislationType: string;
  url: string;
  category: string;
  classification: 'ingestable' | 'inaccessible' | 'metadata_only';
}

interface CensusOutput {
  generated_at: string;
  source: string;
  description: string;
  stats: {
    total: number;
    class_ingestable: number;
    class_inaccessible: number;
    class_metadata_only: number;
    by_type: Record<string, number>;
  };
  ingestion?: {
    completed_at: string;
    total_laws: number;
    total_provisions: number;
    coverage_pct: string;
  };
  laws: CensusLaw[];
}

/**
 * Decode Latin-1 HTML entities and clean up text.
 */
function cleanHtmlText(raw: string): string {
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, '\u00E1')
    .replace(/&agrave;/g, '\u00E0')
    .replace(/&atilde;/g, '\u00E3')
    .replace(/&acirc;/g, '\u00E2')
    .replace(/&eacute;/g, '\u00E9')
    .replace(/&egrave;/g, '\u00E8')
    .replace(/&ecirc;/g, '\u00EA')
    .replace(/&iacute;/g, '\u00ED')
    .replace(/&oacute;/g, '\u00F3')
    .replace(/&otilde;/g, '\u00F5')
    .replace(/&ocirc;/g, '\u00F4')
    .replace(/&uacute;/g, '\u00FA')
    .replace(/&uuml;/g, '\u00FC')
    .replace(/&ccedil;/g, '\u00E7')
    .replace(/&Aacute;/g, '\u00C1')
    .replace(/&Agrave;/g, '\u00C0')
    .replace(/&Atilde;/g, '\u00C3')
    .replace(/&Eacute;/g, '\u00C9')
    .replace(/&Iacute;/g, '\u00CD')
    .replace(/&Oacute;/g, '\u00D3')
    .replace(/&Uacute;/g, '\u00DA')
    .replace(/&Ccedil;/g, '\u00C7')
    .replace(/&ordm;/g, '\u00BA')
    .replace(/&ordf;/g, '\u00AA')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&#\d+;/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a kebab-case ID from the legislation citation.
 * e.g. "Lei n.º 58/2019, de 8 de agosto" -> "pt-lei-58-2019"
 *      "Decreto-Lei n.º 7/2004" -> "pt-dl-7-2004"
 *      "Código Penal" -> "pt-codigo-penal"
 */
function citationToId(citation: string, title: string, nid: string): string {
  // Try to extract legislation type and number from citation
  const match = citation.match(
    /^(Lei|Decreto-Lei|DL|Portaria|Regulamento|Despacho|Decreto|Dec\.\s*Reglm\.|Resolu[çc][ãa]o|Lei Org[âa]nica)\s*n\.?[ºo°]?\s*(\d+(?:[A-Z/-]*)?(?:\/\d+)?)/i
  );

  if (match) {
    let type = match[1].toLowerCase();
    const num = match[2].replace(/\//g, '-');

    // Normalize types
    if (type === 'decreto-lei' || type === 'dl') type = 'dl';
    else if (type === 'lei') type = 'lei';
    else if (type === 'portaria') type = 'portaria';
    else if (type === 'regulamento') type = 'regulamento';
    else if (type === 'despacho') type = 'despacho';
    else if (type === 'decreto') type = 'decreto';
    else if (type.startsWith('dec.')) type = 'dec-reglm';
    else if (type.startsWith('resolu')) type = 'resolucao';
    else if (type.startsWith('lei org')) type = 'lei-organica';

    return `pt-${type}-${num}`.toLowerCase();
  }

  // For codes/constitutions, use the title
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);

  return `pt-${slug || `nid-${nid}`}`;
}

/**
 * Classify a law's legislation type from its citation.
 */
function classifyType(citation: string): string {
  const c = citation.toLowerCase();
  if (c.startsWith('lei n') || c.startsWith('lei ')) return 'Lei';
  if (c.startsWith('decreto-lei') || c.startsWith('dl ')) return 'Decreto-Lei';
  if (c.startsWith('portaria')) return 'Portaria';
  if (c.startsWith('regulamento')) return 'Regulamento';
  if (c.startsWith('despacho')) return 'Despacho';
  if (c.startsWith('decreto ') || c.startsWith('dec.')) return 'Decreto';
  if (c.startsWith('resolu')) return 'Resolução';
  if (c.startsWith('lei org')) return 'Lei Orgânica';
  if (c.includes('código') || c.includes('codigo')) return 'Código';
  return 'Outro';
}

/**
 * Parse a single listing page and extract all law entries.
 */
function parseListingPage(html: string): CensusLaw[] {
  const laws: CensusLaw[] = [];

  // Pattern: nid=NNN&tabela=leis...">TITLE<i>CITATION</i>
  const entryRegex = /nid=(\d+)&tabela=leis[^"]*">\s*(?:&nbsp;)?\s*([^<]+)<i>\s*(?:&nbsp;)?-?\s*([^<]+)<\/i>/gi;

  let match: RegExpExecArray | null;

  // Extract category headings
  const categoryRegex = /font-weight:bold;color:#000000[^>]*>\s*(?:&nbsp;)?\s*([^<]+)<\/a>/gi;
  const categories: { name: string; pos: number }[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = categoryRegex.exec(html)) !== null) {
    categories.push({ name: cleanHtmlText(cm[1]), pos: cm.index });
  }

  while ((match = entryRegex.exec(html)) !== null) {
    const nid = match[1];
    const rawTitle = cleanHtmlText(match[2]);
    const rawCitation = cleanHtmlText(match[3]).replace(/^-\s*/, '');

    if (!nid || !rawTitle) continue;

    // Find the category for this entry based on position in HTML
    let currentCategory = '';
    for (const cat of categories) {
      if (cat.pos < match.index) {
        currentCategory = cat.name;
      } else {
        break;
      }
    }

    const id = citationToId(rawCitation, rawTitle, nid);
    const legislationType = classifyType(rawCitation);
    const url = `https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=${nid}&tabela=leis&ficha=101`;

    laws.push({
      id,
      nid,
      title: rawTitle,
      citation: rawCitation,
      legislationType,
      url,
      category: currentCategory,
      classification: 'ingestable',
    });
  }

  return laws;
}

async function main(): Promise<void> {
  console.log('Portuguese Law MCP — Census');
  console.log('============================\n');
  console.log('  Source:  PGDL (pgdlisboa.pt) — Procuradoria-Geral Distrital de Lisboa');
  console.log('  Method:  Paginated listing scrape (ficha=1,101,201,...,1901)');
  console.log('  License: Portuguese Open Data (attribution required)\n');

  const allLaws: CensusLaw[] = [];
  const seenNids = new Set<string>();
  const seenIds = new Set<string>();

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const ficha = (page - 1) * 100 + 1;
    const url = `${BASE_URL}?ficha=${ficha}&codarea=&pagina=${page}&so_miolo=`;
    process.stdout.write(`  Fetching page ${page}/${TOTAL_PAGES} (ficha=${ficha})...`);

    try {
      const result = await fetchWithRateLimit(url, undefined, 3, true);
      if (result.status !== 200) {
        console.log(` HTTP ${result.status} — skipped`);
        continue;
      }

      const html = result.body;
      const laws = parseListingPage(html);

      let added = 0;
      for (const law of laws) {
        if (!seenNids.has(law.nid)) {
          seenNids.add(law.nid);
          // Ensure unique IDs
          let uniqueId = law.id;
          let suffix = 2;
          while (seenIds.has(uniqueId)) {
            uniqueId = `${law.id}-${suffix}`;
            suffix++;
          }
          law.id = uniqueId;
          seenIds.add(uniqueId);
          allLaws.push(law);
          added++;
        }
      }

      console.log(` ${laws.length} entries (${added} new)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(` ERROR: ${msg}`);
    }
  }

  // Sort by nid for deterministic output
  allLaws.sort((a, b) => parseInt(a.nid, 10) - parseInt(b.nid, 10));

  // Count by type
  const byType: Record<string, number> = {};
  for (const law of allLaws) {
    byType[law.legislationType] = (byType[law.legislationType] ?? 0) + 1;
  }

  // Build census output
  const census: CensusOutput = {
    generated_at: new Date().toISOString(),
    source: 'pgdlisboa.pt (Procuradoria-Geral Distrital de Lisboa — Consolidated Legislation Database)',
    description: 'Full census of Portuguese consolidated legislation (Leis, Decretos-Lei, Códigos, Portarias, Regulamentos, etc.)',
    stats: {
      total: allLaws.length,
      class_ingestable: allLaws.filter(a => a.classification === 'ingestable').length,
      class_inaccessible: allLaws.filter(a => a.classification === 'inaccessible').length,
      class_metadata_only: allLaws.filter(a => a.classification === 'metadata_only').length,
      by_type: byType,
    },
    laws: allLaws,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2) + '\n');

  console.log(`\n${'='.repeat(60)}`);
  console.log('CENSUS COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total laws discovered:  ${allLaws.length}`);
  console.log(`  Ingestable:             ${census.stats.class_ingestable}`);
  console.log(`  Inaccessible:           ${census.stats.class_inaccessible}`);
  console.log(`  Metadata only:          ${census.stats.class_metadata_only}`);
  console.log('\n  By type:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(20)} ${count}`);
  }
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
