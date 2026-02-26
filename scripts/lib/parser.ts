/**
 * HTML parser for Portuguese legislation from PGDL (pgdlisboa.pt).
 *
 * Parses HTML content from the PGDL print view (lei_print_articulado.php)
 * into structured seed JSON for build-db.ts.
 *
 * PGDL print view HTML structure:
 * - Article header: <td class=txt_9_b_l>&nbsp;&nbsp;Artigo N.º<br> (Title)</td>
 * - Article body follows in: <td ... class=txt_9_n_l>content</td>
 * - Chapter headings appear in <td class=txt_9_n_l> or txt_11_b_l cells
 * - Content uses <BR> tags for paragraph breaks
 *
 * Portuguese article format: "Artigo N.º" (e.g., "Artigo 1.º", "Artigo 35.º")
 * Some older laws use "Art." or "ARTIGO N.º" (uppercase).
 * Bis/ter articles: "Artigo 1.º-A", "Artigo 1.º-B"
 *
 * Encoding: PGDL serves ISO-8859-1 — caller must convert to UTF-8 before parsing.
 */

export interface ActIndexEntry {
  id: string;
  nid: string;
  title: string;
  titleEn: string;
  shortName: string;
  citation: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
  /** Legacy DRE ID — kept for backwards compatibility */
  dreId?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Decode HTML entities and strip tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    // Remove script and style blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Convert <BR> tags to newlines for better paragraph detection
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ordm;/g, '\u00BA')
    .replace(/&ordf;/g, '\u00AA')
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
    .replace(/&#\d+;/g, '')
    // Collapse whitespace (preserving single newlines)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Parse PGDL print view HTML to extract provisions.
 *
 * The print view (lei_print_articulado.php) shows ALL articles on a single page
 * with a consistent structure:
 *
 * <td class=txt_9_b_l>&nbsp;&nbsp;Artigo N.º<br> (Title)</td>
 * ... (closing table tags) ...
 * <td ... class=txt_9_n_l>body text</td>
 *
 * We find each article header, extract title, then find the next txt_9_n_l
 * cell for the body content.
 */
export function parsePortugueseHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Strategy: find all article headers and their following content cells
  // Article header pattern in print view
  const articleHeaderRegex = /(?:Artigo|ARTIGO|Art\.?)\s+(\d+(?:\.\u00BA|\.\u00B0|\.o)?(?:-[A-Z])?)\s*(?:\.\u00BA|\.\u00B0|\.o)?\s*(?:<br\s*\/?>)?\s*\(?([^)<]*)\)?/gi;

  // Build a list of all article positions with their header info
  const articlePositions: { num: string; title: string; pos: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = articleHeaderRegex.exec(html)) !== null) {
    let num = match[1]
      .replace(/\.\u00BA/g, '')
      .replace(/\.\u00B0/g, '')
      .replace(/\.o/g, '')
      .trim();

    let title = match[2] ? stripHtml(match[2]).replace(/\n/g, ' ').trim() : '';

    // Skip matches inside <option> or <select> tags
    const before = html.substring(Math.max(0, match.index - 300), match.index);
    const lastOptionOpen = before.lastIndexOf('<option');
    const lastOptionClose = before.lastIndexOf('</option');
    if (lastOptionOpen > lastOptionClose) continue;
    const lastSelectOpen = before.lastIndexOf('<select');
    const lastSelectClose = before.lastIndexOf('</select');
    if (lastSelectOpen > lastSelectClose) continue;

    // Avoid duplicate nearby matches
    const lastEntry = articlePositions[articlePositions.length - 1];
    if (lastEntry && lastEntry.num === num && match.index - lastEntry.pos < 500) {
      // Keep the later occurrence
      articlePositions[articlePositions.length - 1] = { num, title, pos: match.index };
      continue;
    }

    articlePositions.push({ num, title, pos: match.index });
  }

  // Now find chapter headings throughout the document
  const chapterPositions: { heading: string; pos: number }[] = [];
  const chapterRegex = /(?:<td[^>]*class=txt_\d+_b_l[^>]*>|<b>)\s*((?:CAP[IÍ]TULO|T[IÍ]TULO|SEC[CÇ][AÃ]O|PARTE|LIVRO)\s+[IVXLCDM\d]+(?:\s*[-–]?\s*[^<]{0,120})?)/gi;
  let cm: RegExpExecArray | null;
  while ((cm = chapterRegex.exec(html)) !== null) {
    chapterPositions.push({
      heading: stripHtml(cm[1]).replace(/\n/g, ' ').trim(),
      pos: cm.index,
    });
  }

  function findChapter(pos: number): string {
    let chapter = '';
    for (const cp of chapterPositions) {
      if (cp.pos < pos) chapter = cp.heading;
      else break;
    }
    return chapter;
  }

  // For each article, find the body content in the next txt_9_n_l or txt_base_n_l cell
  for (let i = 0; i < articlePositions.length; i++) {
    const article = articlePositions[i];
    const startPos = article.pos;

    // Look for the content cell after the article header
    // The content is in <td ... class=txt_9_n_l> or <td ... class=txt_base_n_l>
    const searchEnd = i + 1 < articlePositions.length
      ? articlePositions[i + 1].pos
      : Math.min(startPos + 20000, html.length);

    const afterHeader = html.substring(startPos, searchEnd);

    // Find the content cell
    const contentCellMatch = afterHeader.match(
      /<td[^>]*class=(?:txt_9_n_l|txt_base_n_l)[^>]*>([\s\S]*?)(?:<\/td>|<tr>)/i
    );

    let content = '';
    if (contentCellMatch) {
      content = stripHtml(contentCellMatch[1]);
    } else {
      // Fallback: try to extract text between this article and the next
      const rawContent = stripHtml(afterHeader);
      // Remove the article header from content
      content = rawContent
        .replace(/^(?:Artigo|ARTIGO|Art\.?)\s+\d+[^\n]*\n?/i, '')
        .replace(/^\([^)]+\)\s*/i, '')
        .trim();
    }

    // Skip articles with very little content
    if (content.length < 5) continue;

    // Cap content at 8K characters
    if (content.length > 8000) {
      content = content.substring(0, 8000);
    }

    // Remove trailing decoration/annotation markers
    content = content.replace(/\s*_{3,}\s*$/, '').trim();

    const chapter = findChapter(startPos);
    const normalizedNum = article.num.replace(/_/g, '');
    const provisionRef = `art${normalizedNum}`;

    provisions.push({
      provision_ref: provisionRef,
      chapter: chapter || undefined,
      section: normalizedNum,
      title: article.title,
      content,
    });

    // Extract definitions if this article is about definitions
    if (article.title.toLowerCase().includes('defini') || article.title.toLowerCase().includes('conceito')) {
      extractDefinitions(contentCellMatch?.[1] ?? afterHeader, provisionRef, definitions);
    }
  }

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

/**
 * Extract term definitions from a definitions article.
 *
 * Portuguese legislation typically defines terms in lettered lists:
 * a) «Termo» - definição ...
 * b) «Outro termo» - definição ...
 */
function extractDefinitions(
  articleHtml: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  const defRegex = /[a-z]\)\s*[«"\u201C]([^»"\u201D]+)[»"\u201D]\s*[-–—:]\s*([^;]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = defRegex.exec(articleHtml)) !== null) {
    const term = stripHtml(match[1]).replace(/\n/g, ' ').trim();
    const definition = stripHtml(match[2]).replace(/\n/g, ' ').trim();

    if (term && definition && term.length < 200) {
      definitions.push({
        term,
        definition,
        source_provision: sourceProvision,
      });
    }
  }
}

/**
 * Pre-configured list of key Portuguese acts (legacy seed data).
 * Used as fallback when census.json is not available.
 */
export const KEY_PORTUGUESE_ACTS: ActIndexEntry[] = [
  {
    id: 'pt-lei-58-2019',
    nid: '3210',
    dreId: '123815982',
    title: 'Lei n.º 58/2019, de 8 de agosto — Assegura a execução, na ordem jurídica nacional, do Regulamento (UE) 2016/679 (proteção de dados)',
    titleEn: 'Law 58/2019 — GDPR Implementation (National Execution of Regulation (EU) 2016/679)',
    shortName: 'Lei 58/2019',
    citation: 'Lei n.º 58/2019, de 8 de agosto',
    status: 'in_force',
    issuedDate: '2019-08-08',
    inForceDate: '2019-08-09',
    url: 'https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=3210&nversao=',
    description: 'Portuguese GDPR implementation law.',
  },
  {
    id: 'pt-lei-46-2018',
    nid: '3059',
    dreId: '116029384',
    title: 'Lei n.º 46/2018, de 13 de agosto — Estabelece o regime jurídico da segurança do ciberespaço',
    titleEn: 'Law 46/2018 — Legal Framework for Cyberspace Security (NIS Directive Transposition)',
    shortName: 'Lei 46/2018',
    citation: 'Lei n.º 46/2018, de 13 de agosto',
    status: 'in_force',
    issuedDate: '2018-08-13',
    inForceDate: '2018-08-14',
    url: 'https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=3059&nversao=',
    description: 'Transposes NIS Directive (EU) 2016/1148.',
  },
  {
    id: 'pt-constituicao',
    nid: '4',
    dreId: '34520775',
    title: 'Constituição da República Portuguesa',
    titleEn: 'Constitution of the Portuguese Republic',
    shortName: 'Constituição',
    citation: 'Decreto de 10 de Abril de 1976',
    status: 'in_force',
    issuedDate: '1976-04-02',
    inForceDate: '1976-04-25',
    url: 'https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=4&nversao=',
    description: 'Portuguese Constitution.',
  },
  {
    id: 'pt-codigo-penal',
    nid: '109',
    dreId: '34437675',
    title: 'Código Penal',
    titleEn: 'Criminal Code (Cybercrime Provisions)',
    shortName: 'Código Penal',
    citation: 'DL n.º 48/95, de 15 de Março',
    status: 'in_force',
    issuedDate: '1982-09-23',
    inForceDate: '1983-01-01',
    url: 'https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=109&nversao=',
    description: 'Portuguese Criminal Code.',
  },
  {
    id: 'pt-lei-109-2009',
    nid: '1137',
    dreId: '483437',
    title: 'Lei n.º 109/2009, de 15 de setembro — Lei do Cibercrime',
    titleEn: 'Law 109/2009 — Cybercrime Law (Budapest Convention Transposition)',
    shortName: 'Lei 109/2009',
    citation: 'Lei n.º 109/2009, de 15 de setembro',
    status: 'in_force',
    issuedDate: '2009-09-15',
    inForceDate: '2009-10-15',
    url: 'https://www.pgdlisboa.pt/leis/lei_print_articulado.php?tabela=leis&nid=1137&nversao=',
    description: 'Portuguese Cybercrime Law.',
  },
];
