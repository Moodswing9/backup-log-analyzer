---
name: backup-log-analyzer
description: AI-powered backup log analysis — single-log severity report or diff mode to surface regressions between two captures. Claude Haiku 4.5 streaming via Next.js 16 API route with PII redaction and rate limiting. /analyze-log terminal command included.
---

# Backup Log Analyzer

Paste any backup or infrastructure log → Claude Haiku 4.5 streams back a structured report: color-coded severity badge, numbered issues, root causes, and copy-pasteable remediation commands. Live SaaS at `backup-log-analyzer.vercel.app`. Also available as `/analyze-log` in Claude Code.

## Trigger

Activate this skill when the user asks about:
- Analyzing backup or infrastructure logs (PPDM, NetWorker, Data Domain, Veeam, syslog)
- `/analyze-log` command — single log or `--diff` mode
- Diff mode: comparing two log captures to surface regressions
- The Next.js API route, streaming response, or PII redaction implementation
- Adding a new log source or modifying the system prompt
- Rate limiting, security, or Vercel deployment

---

## Supported Log Sources

| Source | Examples |
|---|---|
| **Dell PPDM** | Protection job failures, ES cluster health, asset errors |
| **Dell NetWorker** | NSR peer mismatches, savefs connection errors, backup failures |
| **Data Domain** | DDBoost status, filesystem capacity, replication errors |
| **Veeam** | Job failures, proxy errors, repository warnings |
| **Linux syslog** | `journalctl`, `/var/log/messages`, `dmesg` |
| **Windows Event Log** | Application, System, Security event exports |

---

## Two Modes

### Single Mode (default)
One log → severity badge + full structured analysis.

**POST /api/analyze body:**
```json
{ "logs": "<log text, max 50 000 chars>" }
```

### Diff Mode
Two captures → regression analysis: what appeared, what resolved, what changed severity.

**POST /api/analyze body:**
```json
{
  "logsBefore": "<reference capture, max 25 000 chars>",
  "logsAfter":  "<current capture, max 25 000 chars>",
  "mode": "diff"
}
```

**Diff output sections:**
1. **Regressions** — issues in `after` not in `before`
2. **Resolved** — issues in `before` gone from `after`
3. **Changed** — same pattern, different severity

---

## API Route

`POST /api/analyze` — `src/app/api/analyze/route.ts`

**Flow:**
1. Validate input (max chars, required fields for mode)
2. PII redaction (server-side, before Claude call)
3. Rate limit check — 10 req/min per source IP, sliding window, in-memory
4. Stream `claude-haiku-4-5-20251001` via `ReadableStream`
5. Return `Content-Type: text/plain; charset=utf-8` — client reads with `getReader()` loop

**Model:** `claude-haiku-4-5-20251001`, `max_tokens: 2048`

---

## PII Redaction

Applied server-side before any text reaches Claude:

| Pattern | What Gets Stripped |
|---|---|
| Bearer tokens | `Authorization: Bearer eyJ…` |
| Basic auth | `Authorization: Basic dXNl…` |
| JSON credential fields | `"password": "secret"` → `"password": "[REDACTED]"` |
| Email addresses | `user@domain.com` |
| IPv4 octets (3rd+4th) | `192.168.1.42` → `192.168.[REDACTED]` |

---

## Severity Levels

| Badge | Meaning |
|---|---|
| 🔴 CRITICAL | Service down or data at risk — act immediately |
| 🟠 HIGH | Significant failure impacting backups |
| 🟡 MEDIUM | Warnings needing attention soon |
| 🟢 LOW | Minor issues, minimal impact |
| 🔵 INFO | No problems detected |

---

## System Prompts

**Single mode** — instructs Claude to produce:
1. Severity badge (CRITICAL/HIGH/MEDIUM/LOW/INFO)
2. One-paragraph summary
3. Numbered issues with root cause per issue
4. Copy-pasteable remediation commands (specific to the log source)
5. Prevention guidance

**Diff mode** — instructs Claude to compare REFERENCE vs CURRENT:
- Section 1: Regressions (new issues)
- Section 2: Resolved issues
- Section 3: Changed severity patterns

---

## Rate Limiting

10 requests per 60-second sliding window per source IP. HTTP 429 on breach. In-memory — resets on server restart (acceptable for Vercel serverless; no Redis needed at current scale).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI | `claude-haiku-4-5-20251001` via Anthropic SDK |
| Streaming | `ReadableStream` → `response.body.getReader()` |
| Deployment | Vercel |

---

## Claude Code Command — /analyze-log

Mirrors the web app exactly: same system prompts, same PII redaction, same 50 000-char limit, same diff mode.

```bash
# Single log
/analyze-log /var/log/ppdmwatch/ppdmwatch.log

# Diff mode
/analyze-log /var/log/before.log --diff /var/log/after.log
```

Requires `ANTHROPIC_API_KEY` and `pip install anthropic`.

---

## Few-Shot Examples

**Q: How do I extend the analysis to cover Data Domain dedup ratio warnings?**
A: Add a sentence to the single-mode system prompt under "What to look for" specifying `ddfsck` output, `filesys show space`, and dedup ratio thresholds (warn below 20:1). No code changes — the prompt fully drives Claude's domain coverage.

**Q: The stream cuts off after the first chunk.**
A: Confirm `route.ts` returns a `Response` with a `ReadableStream` body and `Content-Type: text/plain; charset=utf-8`. The client must call `getReader()` in a `while(true)` loop — not `await response.text()`, which buffers the entire body and misses streaming.

**Q: How do I raise the 50 000-char limit?**
A: Change `MAX_CHARS = 50000` in `route.ts` and `MAX_CHARS_EACH = 25000` for diff mode. Haiku's context window is ~200k tokens; 50k chars ≈ 12.5k tokens — well within limits. Monitor latency and cost at higher values.

**Q: What's the difference between a HIGH and CRITICAL result?**
A: CRITICAL = data at risk or service completely down (e.g., all backups failing, PPDM unreachable). HIGH = significant failure with impact on backup success rate but not total outage. Use severity to prioritise — page on CRITICAL, ticket on HIGH.

**Q: How do I deploy my own instance with a custom API key?**
A: `git clone`, `npm install`, create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-…`, then `npm run dev`. For production: `npx vercel --prod` then `npx vercel env add ANTHROPIC_API_KEY production`.
