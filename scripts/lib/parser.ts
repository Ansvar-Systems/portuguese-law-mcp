/**
 * HTML parser for Portuguese legislation from DRE (dre.pt).
 *
 * Parses HTML content from DRE into structured seed JSON.
 * Portuguese legislation uses "Artigo X.º" format for articles,
 * with numbered paragraphs (n.º 1, 2, ...) and lettered sub-items (a), b), ...).
 *
 * DRE HTML structure varies by document type:
 * - Consolidated legislation uses structured HTML with article divisions
 * - Individual acts may use less structured formatting
 *
 * This parser handles both patterns and normalises to the seed format
 * expected by build-db.ts.
 */

export interface ActIndexEntry {
  id: string;
  dreId: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
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
    .replace(/&#\d+;/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the chapter/section heading closest above a given position in the HTML.
 */
function findChapterHeading(html: string, articlePos: number): string {
  const beforeArticle = html.substring(Math.max(0, articlePos - 8000), articlePos);

  // Portuguese legislation uses patterns like:
  // CAPÍTULO I, CAPÍTULO II, TÍTULO I, SECÇÃO I, etc.
  const headingPatterns = [
    /<h[1-4][^>]*>\s*((?:CAP[IÍ]TULO|T[IÍ]TULO|SEC[CÇ][AÃ]O|PARTE|LIVRO)\s+[IVXLCDM\d]+(?:\s*[-–]\s*[^<]*)?)\s*<\/h[1-4]>/gi,
    /\b(CAP[IÍ]TULO\s+[IVXLCDM\d]+(?:\s*[-–]\s*[^\n<]{3,80})?)/gi,
    /\b(T[IÍ]TULO\s+[IVXLCDM\d]+(?:\s*[-–]\s*[^\n<]{3,80})?)/gi,
    /\b(SEC[CÇ][AÃ]O\s+[IVXLCDM\d]+(?:\s*[-–]\s*[^\n<]{3,80})?)/gi,
  ];

  for (const pattern of headingPatterns) {
    const matches = [...beforeArticle.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      return stripHtml(lastMatch[1]).trim();
    }
  }

  return '';
}

/**
 * Parse Portuguese legislation HTML to extract provisions.
 *
 * Portuguese articles follow the format "Artigo N.º" (e.g., "Artigo 1.º", "Artigo 35.º").
 * Some older legislation uses "Art." or "Artigo N.°" (with degree sign instead of ordinal).
 *
 * The parser looks for article boundaries and extracts content between them.
 */
export function parsePortugueseHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Find all article boundaries using Portuguese "Artigo X.º" pattern
  // Handles: "Artigo 1.º", "Artigo 1.°", "Artigo 1.o", "Art. 1.º"
  // Also handles "Artigo 1.º-A" (bis articles)
  const articleRegex = /(?:<[^>]*>)?\s*(?:Artigo|Art\.?)\s+(\d+(?:\.\u00BA|\.\u00B0|\.o)?(?:-[A-Z])?)\s*(?:\.\u00BA|\.\u00B0|\.o)?\s*[-–]?\s*/gi;

  const articleMatches: { num: string; pos: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null) {
    // Normalize the article number: strip ordinal indicators
    let num = match[1]
      .replace(/\.\u00BA/g, '')   // .º
      .replace(/\.\u00B0/g, '')   // .°
      .replace(/\.o/g, '')        // .o
      .trim();

    // Avoid duplicates at nearby positions (same article matched twice)
    const lastMatch = articleMatches[articleMatches.length - 1];
    if (lastMatch && lastMatch.num === num && match.index - lastMatch.pos < 200) {
      continue;
    }

    articleMatches.push({ num, pos: match.index });
  }

  for (let i = 0; i < articleMatches.length; i++) {
    const articleMatch = articleMatches[i];
    const startPos = articleMatch.pos;

    // Extract content up to the next article or end
    const endPos = i + 1 < articleMatches.length
      ? articleMatches[i + 1].pos
      : Math.min(startPos + 15000, html.length);

    const articleHtml = html.substring(startPos, endPos);

    // Extract article title: text after "Artigo N.º" on the same line/element
    // Portuguese pattern: "Artigo 1.º\nObjeto" or "Artigo 1.º - Objeto"
    const titleMatch = articleHtml.match(
      /(?:Artigo|Art\.?)\s+\d+[^-–\n<]*[-–\s]*([^\n<]{2,120})/i
    );
    let title = '';
    if (titleMatch) {
      title = stripHtml(titleMatch[1]).trim();
      // Remove leading dash/hyphen that may remain
      title = title.replace(/^[-–—]\s*/, '').trim();
    }

    // Extract the full text content of the article
    let content = stripHtml(articleHtml);

    // Remove the article header from the content
    content = content
      .replace(/^(?:Artigo|Art\.?)\s+\d+[^\n]*\n?/i, '')
      .trim();

    // Skip articles with very little content
    if (content.length < 10) continue;

    // Cap content at 8K characters
    if (content.length > 8000) {
      content = content.substring(0, 8000);
    }

    // Find the chapter heading for context
    const chapter = findChapterHeading(html, startPos);

    // Normalize provision_ref: "art1", "art2", "art35", "art1-A"
    const normalizedNum = articleMatch.num.replace(/_/g, '');
    const provisionRef = `art${normalizedNum}`;

    provisions.push({
      provision_ref: provisionRef,
      chapter: chapter || undefined,
      section: normalizedNum,
      title,
      content,
    });

    // Extract definitions if this article is about definitions
    if (title.toLowerCase().includes('defini') || title.toLowerCase().includes('conceito')) {
      extractDefinitions(articleHtml, provisionRef, definitions);
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
 *
 * Or numbered lists with quotation marks (guillemets).
 */
function extractDefinitions(
  articleHtml: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  // Pattern: a) «Term» definition... or a) "Term" - definition...
  const defRegex = /[a-z]\)\s*[«"\u201C]([^»"\u201D]+)[»"\u201D]\s*[-–—:]\s*([^;]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = defRegex.exec(articleHtml)) !== null) {
    const term = stripHtml(match[1]).trim();
    const definition = stripHtml(match[2]).trim();

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
 * Pre-configured list of key Portuguese acts to ingest.
 *
 * These are the most important Portuguese statutes for cybersecurity,
 * data protection, corporate governance, and compliance use cases.
 *
 * DRE IDs are used to construct fetch URLs. The url field points to the
 * human-readable DRE page.
 */
export const KEY_PORTUGUESE_ACTS: ActIndexEntry[] = [
  {
    id: 'pt-lei-58-2019',
    dreId: '123815982',
    title: 'Lei n.º 58/2019, de 8 de agosto — Assegura a execução, na ordem jurídica nacional, do Regulamento (UE) 2016/679 (proteção de dados)',
    titleEn: 'Law 58/2019 — GDPR Implementation (National Execution of Regulation (EU) 2016/679)',
    shortName: 'Lei 58/2019',
    status: 'in_force',
    issuedDate: '2019-08-08',
    inForceDate: '2019-08-09',
    url: 'https://dre.pt/pesquisa/-/search/123815982/details/maximized',
    description: 'Portuguese GDPR implementation law. Sets age of digital consent at 13, regulates CNPD powers, provides for journalism/research derogations, and defines administrative offences for data protection violations.',
  },
  {
    id: 'pt-lei-46-2018',
    dreId: '116029384',
    title: 'Lei n.º 46/2018, de 13 de agosto — Estabelece o regime jurídico da segurança do ciberespaço',
    titleEn: 'Law 46/2018 — Legal Framework for Cyberspace Security (NIS Directive Transposition)',
    shortName: 'Lei 46/2018',
    status: 'in_force',
    issuedDate: '2018-08-13',
    inForceDate: '2018-08-14',
    url: 'https://dre.pt/pesquisa/-/search/116029384/details/maximized',
    description: 'Transposes NIS Directive (EU) 2016/1148. Establishes CNCS as national cybersecurity authority, defines obligations for operators of essential services and digital service providers.',
  },
  {
    id: 'pt-csc',
    dreId: '34546475',
    title: 'Código das Sociedades Comerciais (CSC)',
    titleEn: 'Commercial Companies Code (CSC)',
    shortName: 'CSC',
    status: 'in_force',
    issuedDate: '1986-09-02',
    inForceDate: '1986-11-01',
    url: 'https://dre.pt/legislacao-consolidada/-/lc/34546475/view',
    description: 'Main Portuguese company law statute governing all types of commercial companies (SA, Lda, etc.), corporate governance, directors duties, and reporting obligations.',
  },
  {
    id: 'pt-codigo-penal',
    dreId: '34437675',
    title: 'Código Penal',
    titleEn: 'Criminal Code (Cybercrime Provisions)',
    shortName: 'Código Penal',
    status: 'in_force',
    issuedDate: '1982-09-23',
    inForceDate: '1983-01-01',
    url: 'https://dre.pt/legislacao-consolidada/-/lc/34437675/view',
    description: 'Portuguese Criminal Code. Key cybersecurity provisions: Art. 193 (invasion of privacy), Art. 194 (interception of communications), Art. 221 (computer fraud).',
  },
  {
    id: 'pt-dl-7-2004',
    dreId: '550006',
    title: 'Decreto-Lei n.º 7/2004, de 7 de janeiro — Comércio eletrónico',
    titleEn: 'Decree-Law 7/2004 — Electronic Commerce (E-Commerce Directive Transposition)',
    shortName: 'DL 7/2004',
    status: 'in_force',
    issuedDate: '2004-01-07',
    inForceDate: '2004-01-08',
    url: 'https://dre.pt/pesquisa/-/search/550006/details/maximized',
    description: 'Transposes EU E-Commerce Directive 2000/31/EC. Regulates information society services, electronic contracts, intermediary liability, and commercial communications.',
  },
  {
    id: 'pt-lei-16-2022',
    dreId: '188619498',
    title: 'Lei n.º 16/2022, de 16 de agosto — Lei das Comunicações Eletrónicas',
    titleEn: 'Law 16/2022 — Electronic Communications Law (EECC Transposition)',
    shortName: 'Lei 16/2022',
    status: 'in_force',
    issuedDate: '2022-08-16',
    inForceDate: '2022-10-15',
    url: 'https://dre.pt/pesquisa/-/search/188619498/details/maximized',
    description: 'Transposes European Electronic Communications Code (Directive (EU) 2018/1972). Regulates electronic communications networks and services, end-user rights, spectrum management.',
  },
  {
    id: 'pt-constituicao',
    dreId: '34520775',
    title: 'Constituição da República Portuguesa',
    titleEn: 'Constitution of the Portuguese Republic',
    shortName: 'Constituição',
    status: 'in_force',
    issuedDate: '1976-04-02',
    inForceDate: '1976-04-25',
    url: 'https://dre.pt/legislacao-consolidada/-/lc/34520775/view',
    description: 'Portuguese Constitution. Art. 35 (utilização da informática) provides explicit constitutional protection for digital rights and personal data, one of few European constitutions with such provisions.',
  },
  {
    id: 'pt-lei-109-2009',
    dreId: '483437',
    title: 'Lei n.º 109/2009, de 15 de setembro — Lei do Cibercrime',
    titleEn: 'Law 109/2009 — Cybercrime Law (Budapest Convention Transposition)',
    shortName: 'Lei 109/2009',
    status: 'in_force',
    issuedDate: '2009-09-15',
    inForceDate: '2009-10-15',
    url: 'https://dre.pt/pesquisa/-/search/483437/details/maximized',
    description: 'Portuguese Cybercrime Law transposing Council of Europe Budapest Convention. Defines computer crimes including illegal access, interception, data interference, system interference, and computer-related fraud.',
  },
  {
    id: 'pt-lei-41-2004',
    dreId: '480710',
    title: 'Lei n.º 41/2004, de 18 de agosto — Proteção de dados pessoais nas comunicações eletrónicas',
    titleEn: 'Law 41/2004 — Privacy in Electronic Communications (ePrivacy Transposition)',
    shortName: 'Lei 41/2004',
    status: 'in_force',
    issuedDate: '2004-08-18',
    inForceDate: '2004-08-19',
    url: 'https://dre.pt/pesquisa/-/search/480710/details/maximized',
    description: 'Transposes ePrivacy Directive 2002/58/EC. Regulates processing of personal data and privacy protection in electronic communications, including cookies, traffic data, and unsolicited communications.',
  },
  {
    id: 'pt-lei-67-98',
    dreId: '239857',
    title: 'Lei n.º 67/98, de 26 de outubro — Lei da Proteção de Dados Pessoais',
    titleEn: 'Law 67/98 — Personal Data Protection Act (Former DPA, Partially in Force)',
    shortName: 'Lei 67/98',
    status: 'amended',
    issuedDate: '1998-10-26',
    inForceDate: '1998-10-27',
    url: 'https://dre.pt/pesquisa/-/search/239857/details/maximized',
    description: 'Former Portuguese Data Protection Act transposing Directive 95/46/EC. Largely superseded by Lei 58/2019 (GDPR implementation) but some provisions remain in force for specific contexts.',
  },
];
