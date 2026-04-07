# Portuguese Law MCP Server

**The Diário da República alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fportuguese-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/portuguese-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/portuguese-law-mcp?style=social)](https://github.com/Ansvar-Systems/portuguese-law-mcp)
[![CI](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-81%2C012-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **1,130 Portuguese statutes** -- from the Lei n.º 58/2019 (proteção de dados pessoais) and Código Penal to the Código Civil, Código do Trabalho, Decreto-Lei n.º 7/2004 (comércio eletrónico), and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Portuguese legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Portuguese legal research means navigating dre.pt (Diário da República Eletrónico), tracking Leis, Decretos-Lei, Portarias, and Despachos across multiple ministries, and cross-referencing EU transpositions. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking RGPD implementation or Código do Trabalho requirements
- A **legal tech developer** building tools on Portuguese law
- A **researcher** tracing EU directives through to Portuguese legislation

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Portuguese law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-pt/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add portuguese-law --transport http https://mcp.ansvar.eu/law-pt/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "portuguese-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-pt/mcp"
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
      "url": "https://mcp.ansvar.eu/law-pt/mcp"
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

Once connected, just ask naturally -- in Portuguese or English:

- *"O que diz a Lei n.º 58/2019 (proteção de dados pessoais) sobre o consentimento?"*
- *"O Código Penal está em vigor? Quais são as disposições sobre criminalidade informática?"*
- *"Pesquisa por 'proteção de dados pessoais' na legislação portuguesa"*
- *"Quais as diretivas europeias que a Lei n.º 58/2019 implementa?"*
- *"Que diz o Código Civil sobre responsabilidade contratual?"*
- *"Encontre as disposições do Código do Trabalho sobre teletrabalho"*
- *"Quais as leis portuguesas que implementam o RGPD?"*
- *"Which Portuguese laws implement the GDPR?"*
- *"Compare NIS2 implementation requirements across Portuguese statutes"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 1,130 statutes | Portuguese Leis, Decretos-Lei, Códigos, and Portarias |
| **Provisions** | 81,012 sections | Full-text searchable with FTS5 |
| **Preparatory Works** | 297,024 documents | Propostas de lei and parliamentary debates (Premium) |
| **Database Size** | ~76 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against dre.pt |

**Verified data only** -- every citation is validated against official sources (dre.pt). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from dre.pt (Diário da República Eletrónico) official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by lei/decreto-lei identifier + artigo/número
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
dre.pt API → Parse → SQLite → FTS5 snippet() → MCP response
               ↑                      ↑
        Provision parser       Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search dre.pt by número de diploma | Search by plain Portuguese: *"proteção de dados pessoais"* |
| Navigate multi-artigo statutes manually | Get the exact provision with context |
| Manual cross-referencing between diplomas | `build_legal_stance` aggregates across sources |
| "Este diploma está em vigor?" → manual check | `check_currency` tool → answer in seconds |
| Find EU basis → dig through EUR-Lex | `get_eu_basis` → linked EU directives instantly |
| Check dre.pt for updates | Daily automated freshness checks |
| No API, no integration | MCP protocol → AI-native |

**Traditional:** Search dre.pt → Download PDF → Ctrl+F → Cross-reference with proposta de lei → Check EUR-Lex → Repeat

**This MCP:** *"Qual o artigo da Lei 58/2019 sobre consentimento e qual a diretiva europeia que lhe dá base?"* → Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search on 81,012 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by lei/decreto-lei identifier + artigo |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes and preparatory works |
| `format_citation` | Format citations per Portuguese conventions (full/short/pinpoint) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations for Portuguese statute |
| `get_portuguese_implementations` | Find Portuguese laws implementing EU act |
| `search_eu_implementations` | Search EU documents with Portuguese implementation counts |
| `get_provision_eu_basis` | Get EU law references for specific provision |
| `validate_eu_compliance` | Check implementation status (requires EU MCP) |

---

## EU Law Integration

Portugal is an EU member state since 1986. Portuguese law extensively implements EU directives, particularly in data protection, financial services, consumer rights, and environmental law.

| Metric | Value |
|--------|-------|
| **EU Member Since** | 1986 |
| **GDPR Implementation** | Lei n.º 58/2019 |
| **NIS2 Implementation** | Lei n.º 65/2021 (cybersecurity) |
| **Data Authority** | Comissão Nacional de Proteção de Dados (CNPD) |
| **EUR-Lex Integration** | Automated metadata fetching |

### Key Portuguese EU Implementations

- **GDPR** (2016/679) → Lei n.º 58/2019 (proteção de dados pessoais)
- **NIS2 Directive** (2022/2555) → Lei n.º 65/2021 and subsequent updates
- **AI Act** (2024/1689) → Portuguese implementation in progress
- **eIDAS** (910/2014) → Decreto-Lei n.º 290-D/99 and updates
- **AML Directive** (2015/849) → Lei n.º 83/2017 (combate ao branqueamento)
- **Consumer Rights Directive** (2011/83) → Decreto-Lei n.º 24/2014

> **Note on statute types:** Portuguese law uses a legislative hierarchy -- Lei (Parliament), Decreto-Lei (Government), Portaria (Ministry), Despacho (Department). The database covers the primary levels (Lei and Decreto-Lei) most relevant for compliance research.

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation.

---

## Data Sources & Freshness

All content is sourced from authoritative Portuguese legal databases:

- **[dre.pt - Diário da República Eletrónico](https://dre.pt/)** -- Official Portuguese law database
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (metadata only)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Imprensa Nacional - Casa da Moeda (INCM) |
| **Retrieval method** | dre.pt API |
| **Language** | Portuguese |
| **License** | Portuguese public data (open government) |
| **Coverage** | 1,130 statutes (Leis, Decretos-Lei, Códigos, Portarias) |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | dre.pt API date comparison | All 1,130 statutes checked |
| **New diplomas** | dre.pt Diário da República feed | Diffed against database |
| **EU reference staleness** | Git commit timestamps | Flagged if >90 days old |

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official dre.pt publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is limited** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (dre.pt) for court filings
> - **EU cross-references** are extracted from Portuguese statute text, not EUR-Lex full text
> - **Portarias and Despachos** (ministerial orders) are only partially covered -- check relevant ministry websites for complete guidance

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for Ordem dos Advogados compliance guidance.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

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

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                     # Ingest statutes from dre.pt
npm run build:db                   # Rebuild SQLite database
npm run drift:detect               # Run drift detection
npm run check-updates              # Check for amendments and new statutes
npm run census                     # Generate coverage census report
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~76 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/portuguese-law-mcp (This Project)
**Query 1,130 Portuguese statutes directly from Claude** -- Lei 58/2019, Código Penal, Código Civil, Código do Trabalho, and more. Full provision text with EU cross-references. `npx @ansvar/portuguese-law-mcp`

### [@ansvar/spanish-law-mcp](https://github.com/Ansvar-Systems/spanish-law-mcp)
**Query Spanish legislation** -- LOPDGDD, Código Penal, Código Civil, and more. `npx @ansvar/spanish-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Austria, Belgium, Brazil, Denmark, Finland, France, Germany, Ireland, Italy, Netherlands, Norway, Poland, Slovenia, Spain, Sweden, Switzerland, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Supremo Tribunal de Justiça, Tribunal Constitucional)
- EU regulation cross-reference expansion
- Portaria and Despacho coverage
- Historical statute versions and amendment tracking

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (1,130 statutes, 81,012 provisions)
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Daily freshness checks
- [ ] Court case law expansion (STJ, Tribunal Constitucional)
- [ ] Historical statute versions (amendment tracking)
- [ ] Portaria and Despacho coverage
- [ ] English translations for key statutes

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{portuguese_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Portuguese Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/portuguese-law-mcp},
  note = {1,130 Portuguese statutes with 81,012 provisions and EU law cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Imprensa Nacional - Casa da Moeda (Portuguese open government data)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Portuguese law -- turns out everyone building compliance tools for the Iberian and Lusophone market has the same research frustrations.

So we're open-sourcing it. Navigating 1,130 diplomas in the Diário da República shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
