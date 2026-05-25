# Changelog

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
