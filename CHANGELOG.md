# Changelog

## [Unreleased]
### Changed
- Upgrade `vitest` and `@vitest/coverage-v8` 2.1.9 → 5.0.1 (vite 5 → 8), clearing the remaining dev-dependency advisories — `npm audit` now reports 0 vulnerabilities
- Require Node.js ≥ 22.12 (`engines`); CI matrix moves from Node 20/22 to 22/24 (Node 20 is end-of-life). `@types/node` → ^22

## [0.7.1] — 2026-09-24
### Security
- Upgrade `next` and `eslint-config-next` 16.2.6 → 16.3.6, fixing critical/high Next.js advisories (Image Optimization RCE, Middleware/Proxy bypass, SSRF, cache confusion) and the bundled `sharp`, `postcss` and `nanoid` advisories — `npm audit --omit=dev` now reports 0 vulnerabilities

### Fixed
- `GET /api/health` reported version `0.3.0`; it now reads the version from `package.json`
- README badge and `.claude-plugin/plugin.json` versions synced
- ESLint errors resolved (removed `as any` casts on cached system prompts, unused test import, documented the post-mount history load)

### Changed
- CI runs `npm run lint` in addition to tests

## [0.7.0] — 2026-07-16
### Added
- **Analysis history** — the last 20 analyses are saved to `localStorage`; the history panel shows timestamp, label and mode, with Load, Delete and Clear all

## [0.6.0] — 2026-07-14
### Added
- **Batch mode** — analyze up to 5 log files at once (upload or paste); each file goes through the taxonomy fast-path, then Claude, and results are merged into one Markdown report

## [0.5.0] — 2026-07-10
### Added
- **Structured error taxonomy** (`src/lib/error-taxonomy.ts`) — 12 known patterns (6 PPDM, 4 NetWorker, 2 Data Domain) classified offline with error code, root cause and fix commands; no API call when a pattern matches
- 16 taxonomy unit tests

## [0.4.0] — 2026-06-10
### Changed
- Log analysis upgraded from Claude Haiku 4.5 to Claude Opus 4.7, with prompt caching on both system prompts
- `SKILL.md` and `/analyze-log` command synced to Opus 4.7
- README screenshot from the live Vercel deployment

## [0.3.0] — 2026-05-23
### Added
- **Diff Mode** — compare two log captures (reference vs current) to surface regressions, resolved issues, and changed patterns
- Streaming UX: bouncing dots while waiting for first chunk; blinking cursor while stream is writing
- Download as `.md` button — saves dated markdown file (`analysis-YYYY-MM-DD.md`)
- `GET /api/health` endpoint returning `{status, version, ts}`
- `src/lib/redact.ts` extracted as standalone module with 16 vitest unit tests
- `src/__tests__/rateLimit.test.ts` — 6 tests for rate limiter using `vi.useFakeTimers()`
- GitHub Actions CI — vitest on Node 20 and 22

### Changed
- Copy button shows "Copied!" confirmation for 2 seconds after click

## [0.2.0] — 2026-04-15
### Added
- Server-side PII redaction: Bearer/Basic tokens, AWS key IDs, AWS secret keys, DB connection strings, PEM private keys, emails, IPv4 addresses
- Per-IP rate limiting: 10 requests per 60-second window, 429 on breach
- Copy Analysis button

## [0.1.0] — 2026-04-01
### Added
- Streaming log analysis via Claude Haiku 4.5
- Severity badge (CRITICAL / HIGH / MEDIUM / LOW / INFO) extracted from markdown response
- Structured markdown output: Summary, Issues Detected, Root Causes, Recommended Actions, Prevention
- 50,000-character input limit with character counter
- Next.js 16 App Router, Tailwind CSS, deployed on Vercel
