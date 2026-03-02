/**
 * Response metadata utilities for Portuguese Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Diário da República Eletrónico (dre.pt) — Portuguese Government Official Gazette',
    jurisdiction: 'PT',
    disclaimer:
      'This data is sourced from the Diário da República Eletrónico. The authoritative versions are maintained by the Portuguese government. Always verify with the official DRE portal (dre.pt).',
    freshness,
  };
}
