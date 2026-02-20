# Portuguese Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/portuguese-law-mcp)](https://www.npmjs.com/package/@ansvar/portuguese-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/portuguese-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/portuguese-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/portuguese-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Portuguese legislation, including Lei 58/2019 (GDPR implementation), Lei 46/2018 (NIS transposition -- regime juridico da seguranca do ciberespaco), Codigo das Sociedades Comerciais (CSC), Codigo Penal (cybercrime provisions), Decreto-Lei 7/2004 (eCommerce), and Lei 16/2022 (Electronic Communications). All data sourced from the official Diario da Republica Eletronico (dre.pt) operated by INCM.

## Deployment Tier

**SMALL-MEDIUM** -- Dual tier with bundled free database for Vercel deployment.

**Estimated database size:** ~60-120 MB (free tier, core legislation)

## Key Legislation Covered

| Act | Portuguese Name | Significance |
|-----|----------------|-------------|
| **Lei 58/2019 (GDPR Implementation)** | Lei de execucao do RGPD | Portuguese GDPR implementation; age of digital consent set at 13 (one of lowest in EU) |
| **Lei 46/2018 (NIS Transposition)** | Regime juridico da seguranca do ciberespaco | NIS Directive transposition; CNCS as competent authority |
| **Codigo das Sociedades Comerciais (CSC)** | Codigo das Sociedades Comerciais | Main commercial company law statute |
| **Codigo Penal (Cybercrime)** | Codigo Penal, arts. 193-194, 221 | Privacy violations, interception of communications, computer fraud |
| **DL 7/2004 (eCommerce)** | Lei do Comercio Eletronico | Transposition of EU E-Commerce Directive 2000/31/EC |
| **Lei 16/2022 (Electronic Communications)** | Lei das Comunicacoes Eletronicas | Transposition of European Electronic Communications Code (EECC) |
| **Constituicao (Constitution)** | Constituicao da Republica Portuguesa | Art. 35 -- explicit digital rights provision on use of computer data |

## Regulatory Context

- **Data Protection Authority:** CNPD (Comissao Nacional de Protecao de Dados), one of Europe's oldest DPAs, established in 1994 under the 1991 Data Protection Law (Lei 10/91)
- **Cybersecurity Authority:** CNCS (Centro Nacional de Ciberseguranca), designated competent authority under Lei 46/2018
- **Constitutional Digital Rights:** Portugal's Constitution Art. 35 is notable for explicitly addressing "utilizacao da informatica" (use of computer data), making it one of the few European constitutions with a specific digital rights provision
- **Legal System:** Civil law system; Portuguese is the sole official language for all legislation
- **Citation Format:** Diario da Republica references (e.g., Diario da Republica, 1.a serie, N.o 151, de 8 de agosto de 2019); distinction between Lei (Act of Parliament) and Decreto-Lei (Government decree with force of law)

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [DRE (dre.pt)](https://dre.pt) | INCM | API | Daily | Portuguese Open Data | All legislation published in Diario da Republica |
| [CNPD (cnpd.pt)](https://www.cnpd.pt) | CNPD | HTML Scrape | Monthly | Government Publication | Deliberations, opinions, guidelines |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/portuguese-law-mcp
```

## Usage

### As stdio MCP server

```bash
portuguese-law-mcp
```

### In Claude Desktop / MCP client configuration

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

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific article (Artigo) from a Portuguese law |
| `search_legislation` | Full-text search across all Portuguese legislation |
| `get_provision_eu_basis` | Cross-reference lookup for EU directive/regulation relationships (GDPR, NIS, eCommerce, EECC) |
| `validate_citation` | Validate a legal citation against the database (Diario da Republica references) |
| `check_statute_currency` | Check whether a law or provision is the current consolidated version |
| `list_laws` | List all laws in the database with metadata |

## Deployment Tiers

| Tier | Content | Database Size | Platform |
|------|---------|---------------|----------|
| **Free** | All major statutes + EU cross-references | ~60-120 MB | Vercel (bundled) or local |
| **Professional** | + CNPD deliberations + historical consolidated versions + regulatory guidance | ~300-500 MB | Azure Container Apps / Docker / local |

### Deployment Strategy: SMALL-MEDIUM - Dual Tier, Bundled Free

The free-tier database containing core legislation is estimated at 60-120 MB, within the Vercel 250 MB bundle limit. The free-tier database is bundled directly with the Vercel deployment. The professional tier with CNPD deliberations and extended historical coverage requires local Docker or Azure Container Apps deployment.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 4 article retrieval tests (Lei 58/2019 Art 1, Codigo Penal Art 193, CSC Art 1, Lei 46/2018 Art 1)
- 3 search tests (dados pessoais, ciberseguranca, comercio eletronico)
- 2 citation roundtrip tests (dre.pt URL patterns, Diario da Republica references)
- 1 cross-reference test (Lei 58/2019 to GDPR)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./.github/SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/portuguese-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

The law text itself is public domain under Portuguese open data policy. This project's code and database structure are licensed under Apache-2.0.

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
