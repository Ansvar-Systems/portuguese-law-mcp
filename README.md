# Portuguese Law MCP Server

**The Diario da Republica alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fportuguese-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/portuguese-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/portuguese-law-mcp?style=social)](https://github.com/Ansvar-Systems/portuguese-law-mcp)
[![CI](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](#whats-included)
[![Provisions](https://img.shields.io/badge/provisions-56%2C955-blue)](#whats-included)

Query **1,130 Portuguese statutes** -- from the Constituicao and Codigo Penal to Lei 58/2019 (GDPR), Lei 46/2018 (NIS), and Lei 109/2009 (Cybercrime) -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Portuguese legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu)

---

## Why This Exists

Portuguese legal research requires navigating DRE (Diario da Republica Eletronico), PGDL databases, and EUR-Lex cross-references. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking GDPR implementation under Lei 58/2019
- A **legal tech developer** building tools on Portuguese law
- A **researcher** tracing EU directive transpositions into Portuguese law

...you shouldn't need multiple browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Portuguese law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://portuguese-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add portuguese-law --transport http https://portuguese-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "portuguese-law": {
      "type": "url",
      "url": "https://portuguese-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "portuguese-law": {
      "type": "http",
      "url": "https://portuguese-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/portuguese-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "portuguese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/portuguese-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "portuguese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/portuguese-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally:

- *"What does Artigo 35 of the Constituicao say about digital rights?"*
- *"Find provisions about dados pessoais in Portuguese law"*
- *"What EU directives does Lei 58/2019 implement?"*
- *"Which Portuguese laws address cybersecurity requirements?"*
- *"Get Artigo 6 of Lei 109/2009 -- acesso ilegitimo"*
- *"Is Lei 67/98 (old data protection law) still in force?"*
- *"What are the penalties for computer fraud under the Codigo Penal?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 1,130 laws | Full Portuguese consolidated legislation |
| **Provisions** | 56,955 articles | Full-text searchable with FTS5 |
| **Legal Definitions** | 84 definitions | Extracted from definition articles |
| **EU Cross-References** | Auto-extracted | Links to EU directives and regulations |
| **Database Size** | ~76 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against PGDL |

### Legislation Coverage

| Type | Count |
|------|-------|
| **Decreto-Lei** (Government Decree-Law) | 493 |
| **Lei** (Act of Parliament) | 395 |
| **Portaria** (Ministerial Order) | 138 |
| **Resolucao** (Resolution) | 46 |
| **Decreto** (Decree) | 35 |
| **Regulamento** (Regulation) | 22 |
| **Despacho** (Dispatch) | 11 |

### Key Legislation

| Act | Portuguese Name | Significance |
|-----|----------------|-------------|
| **Lei 58/2019** | Lei de execucao do RGPD | Portuguese GDPR implementation; age of digital consent at 13 |
| **Lei 46/2018** | Regime juridico da seguranca do ciberespaco | NIS Directive transposition; CNCS as competent authority |
| **Lei 109/2009** | Lei do Cibercrime | Budapest Convention transposition; cybercrime offences |
| **Constituicao** | Constituicao da Republica Portuguesa | Art. 35 -- explicit digital rights and data protection |
| **Codigo Penal** | Codigo Penal | Privacy violations (Art. 193-194), computer fraud (Art. 221) |
| **CSC** | Codigo das Sociedades Comerciais | Commercial company law, corporate governance |
| **DL 7/2004** | Lei do Comercio Eletronico | E-Commerce Directive transposition |
| **Lei 16/2022** | Lei das Comunicacoes Eletronicas | EECC transposition |

**Verified data only** -- every article is ingested from PGDL (Procuradoria-Geral Distrital de Lisboa), the official consolidated legislation database. Zero LLM-generated content.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search on 56,955 provisions with BM25 ranking |
| `get_provision` | Retrieve specific article by law identifier + article number |
| `list_sources` | List all 1,130 laws in the database with metadata |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from multiple statutes |
| `format_citation` | Format citations per Portuguese conventions (Diario da Republica) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `about` | Server metadata and corpus statistics |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations for Portuguese statute |
| `get_portuguese_implementations` | Find Portuguese laws implementing EU act |
| `search_eu_implementations` | Search EU documents with Portuguese implementation counts |
| `get_provision_eu_basis` | Get EU law references for specific provision |
| `validate_eu_compliance` | Check implementation status |

---

## Data Sources & Freshness

All content is sourced from authoritative Portuguese legal databases:

- **[PGDL (pgdlisboa.pt)](https://www.pgdlisboa.pt)** -- Procuradoria-Geral Distrital de Lisboa consolidated legislation
- **[DRE (dre.pt)](https://dre.pt)** -- Official Diario da Republica Eletronico (INCM)
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (cross-references)

### Regulatory Context

- **Data Protection Authority:** CNPD (Comissao Nacional de Protecao de Dados), one of Europe's oldest DPAs, established 1994
- **Cybersecurity Authority:** CNCS (Centro Nacional de Ciberseguranca), designated under Lei 46/2018
- **Constitutional Digital Rights:** Art. 35 explicitly addresses "utilizacao da informatica" (use of computer data)
- **Legal System:** Civil law; Portuguese is the sole official language for legislation
- **Citation Format:** Diario da Republica references; distinction between Lei (Parliament) and Decreto-Lei (Government)

> Full provenance metadata: [`sources.yml`](./sources.yml)

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |

See [SECURITY.md](.github/SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official PGDL/DRE publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Verify critical citations** against primary sources (dre.pt) for court filings
> - **EU cross-references** are auto-extracted from statute text, not EUR-Lex full text

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/portuguese-law-mcp
cd portuguese-law-mcp
npm install
npm run build
npm test
```

### Data Management

```bash
npm run census                              # Enumerate all laws from PGDL
npm run ingest                              # Full ingestion from census
npm run ingest -- --resume                  # Resume interrupted ingestion
npm run ingest -- --limit 5                 # Test with 5 laws
npm run build:db                            # Rebuild SQLite database
npm run check-updates                       # Check for amendments
npm run drift:detect                        # Detect data drift
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~76 MB (efficient, portable)
- **Reliability:** 99% ingestion success rate (1,130/1,141 laws)

---

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 4 article retrieval tests (Lei 58/2019, Codigo Penal, CSC, Lei 46/2018)
- 3 search tests (dados pessoais, ciberseguranca, comercio eletronico)
- 2 citation roundtrip tests (DRE URL patterns, Diario da Republica references)
- 1 cross-reference test (Lei 58/2019 to GDPR)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

---

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

### Data Licenses

- **Statute text:** Portuguese Government open data (public domain with attribution)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools. This MCP server makes Portuguese law searchable, cross-referenceable, and AI-readable -- so navigating 1,130 statutes doesn't require manual DRE browsing.

**[ansvar.eu](https://ansvar.eu)**

---

<p align="center">
  <sub>Built with care by Ansvar Systems</sub>
</p>
