# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-XX-XX
### Added
- Initial release of Portuguese Law MCP
- `search_legislation` tool for full-text search across all Portuguese statutes
- `get_provision` tool for retrieving specific articles (Artigos)
- `get_provision_eu_basis` tool for EU cross-references (Lei 58/2019-GDPR, Lei 46/2018-NIS)
- `validate_citation` tool for legal citation validation (Diario da Republica references)
- `check_statute_currency` tool for checking statute amendment status
- `list_laws` tool for browsing available legislation
- Coverage of Lei 58/2019, Lei 46/2018, CSC, Codigo Penal (cybercrime), DL 7/2004, Lei 16/2022
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (dual tier bundled free)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/portuguese-law-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Ansvar-Systems/portuguese-law-mcp/releases/tag/v1.0.0
