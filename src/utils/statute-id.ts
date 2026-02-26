/**
 * Statute ID resolution for Portuguese Law MCP.
 *
 * Resolves fuzzy document references (titles, IDs, citations) to database document IDs.
 * Portuguese legislation uses formal citations like "Lei n.º 58/2019, de 8 de agosto"
 * but agents typically use shortened forms like "Lei 58/2019" or "Codigo Penal".
 *
 * Handles:
 * - Direct ID match (e.g., "pt-lei-58-")
 * - Citation-number normalization ("Lei 58/2019" -> matches "Lei n.º 58/2019")
 * - Accent-insensitive matching ("Codigo Penal" -> "Código Penal")
 * - Type abbreviation expansion ("DL 7/2004" -> "Decreto-Lei n.º 7/2004")
 * - Common short names ("Constituicao", "CSC", "Codigo Penal")
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Strip Portuguese diacritics for fuzzy matching.
 * Maps accented characters to their base forms:
 *   á,à,â,ã -> a   é,è,ê -> e   í -> i   ó,ô,õ -> o   ú,ü -> u   ç -> c
 */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a Portuguese law reference for matching.
 * - Strips "n.º" / "n.°" / "nº" so "Lei 58/2019" matches "Lei n.º 58/2019"
 * - Expands "DL" to "Decreto-Lei" and "Decreto-Lei" to "DL" for both-way matching
 * - Strips accents
 * - Lowercases
 */
function normalizeCitation(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/\bn\.?\s*[º°]\s*/g, '')  // Remove "n.º", "nº", "n. º", "n °"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate alternative forms of a Portuguese law identifier for matching.
 * "Decreto-Lei 7/2004" -> also try "DL 7/2004"
 * "DL 7/2004" -> also try "Decreto-Lei 7/2004"
 * "Lei 58/2019" -> also try with "n.º" inserted
 */
function generateAlternatives(input: string): string[] {
  const alternatives: string[] = [input];

  // Decreto-Lei <-> DL
  if (/^decreto-?lei\b/i.test(input)) {
    alternatives.push(input.replace(/^decreto-?lei\b/i, 'DL'));
  } else if (/^DL\b/i.test(input)) {
    alternatives.push(input.replace(/^DL\b/i, 'Decreto-Lei'));
  }

  // Insert "n.º" after type for number-based citations
  // "Lei 58/2019" -> "Lei n.º 58/2019"
  const typeNumMatch = input.match(/^(Lei|DL|Decreto-?Lei|Portaria|Decreto|Resolução|Resolucao|Regulamento|Despacho)\s+(\d)/i);
  if (typeNumMatch) {
    alternatives.push(input.replace(/^(Lei|DL|Decreto-?Lei|Portaria|Decreto|Resolução|Resolucao|Regulamento|Despacho)\s+/i, '$1 n.º '));
  }

  return alternatives;
}

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "pt-lei-58-")
 * - Title/citation substring match (e.g., "Lei 58/2019", "Código Penal")
 * - Accent-insensitive matching (e.g., "Codigo Penal" matches "Código Penal")
 * - Citation normalization (e.g., "Lei 58/2019" matches "Lei n.º 58/2019")
 * - Type abbreviation expansion (e.g., "DL 7/2004" matches "Decreto-Lei n.º 7/2004")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // 2. Title/short_name/title_en LIKE match (exact substring)
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // 3. Try alternative forms (DL <-> Decreto-Lei, insert n.º)
  const alternatives = generateAlternatives(trimmed);
  for (const alt of alternatives) {
    if (alt === trimmed) continue;
    const altResult = db.prepare(
      "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
    ).get(`%${alt}%`, `%${alt}%`, `%${alt}%`) as { id: string } | undefined;
    if (altResult) return altResult.id;
  }

  // 4. Accent-insensitive matching — load all documents and compare normalized forms
  //    This handles "Codigo Penal" matching "Código Penal", "Constituicao" matching "Constituição"
  const normalizedInput = normalizeCitation(trimmed);
  const allDocs = db.prepare(
    'SELECT id, title, short_name, title_en FROM legal_documents'
  ).all() as { id: string; title: string; short_name: string; title_en: string }[];

  for (const doc of allDocs) {
    const fields = [doc.title, doc.short_name, doc.title_en].filter(Boolean);
    for (const field of fields) {
      if (normalizeCitation(field).includes(normalizedInput)) {
        return doc.id;
      }
    }
  }

  // 5. Try accent-insensitive matching with alternative forms
  for (const alt of alternatives) {
    if (alt === trimmed) continue;
    const normalizedAlt = normalizeCitation(alt);
    for (const doc of allDocs) {
      const fields = [doc.title, doc.short_name, doc.title_en].filter(Boolean);
      for (const field of fields) {
        if (normalizeCitation(field).includes(normalizedAlt)) {
          return doc.id;
        }
      }
    }
  }

  return null;
}
