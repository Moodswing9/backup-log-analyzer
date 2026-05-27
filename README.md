<div align="center">

# 🔍 Backup Log Analyzer

**Paste any backup or infrastructure log — Claude identifies errors, root causes, and fix commands in seconds**

[![Version](https://img.shields.io/badge/version-0.3.0-6366f1?style=flat-square)](https://github.com/Moodswing9/backup-log-analyzer/releases)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Moodswing9/backup-log-analyzer/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/Moodswing9/backup-log-analyzer/actions/workflows/ci.yml)
[![Powered by Claude](https://img.shields.io/badge/powered%20by-Claude%20Opus%204.7-f59e0b?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%7C%20TypeScript-3178c6?style=flat-square)](#stack)
[![Deploy](https://img.shields.io/badge/deployed%20on-Vercel-000000?style=flat-square&logo=vercel)](https://backup-log-analyzer.vercel.app)

**[→ Try it live](https://backup-log-analyzer.vercel.app)**

</div>

---

## Overview

Drop any log output into the textarea and hit **Analyze**. Claude Opus 4.7 streams back a structured report with a color-coded severity badge, numbered issues, root causes, and copy-pasteable remediation commands — all in a few seconds. No account required.

**Diff Mode** — paste two log captures (before / after a change or outage) and get a regression analysis: issues that appeared, issues that resolved, and patterns that changed severity. Switch modes with the toggle above the textarea.

Supports logs from:

| Source | Examples |
|:---|:---|
| **Dell EMC PPDM** | Protection job failures, Elasticsearch cluster health, asset errors |
| **Dell EMC NetWorker** | NSR peer mismatches, savefs connection errors, backup failures |
| **Data Domain** | DDBoost status, filesystem capacity alerts, replication errors |
| **Veeam** | Job failures, proxy errors, repository warnings |
| **Linux syslog** | `journalctl`, `/var/log/messages`, `dmesg` |
| **Windows Event Log** | Application, System, Security event exports |

---

## Severity Levels

The analysis opens with a color-coded severity badge:

| Badge | Meaning |
|:---|:---|
| 🔴 **CRITICAL** | Service down or data at risk — act immediately |
| 🟠 **HIGH** | Significant failure that will impact backups |
| 🟡 **MEDIUM** | Warnings that need attention soon |
| 🟢 **LOW** | Minor issues with minimal impact |
| 🔵 **INFO** | No problems detected |

---

## Claude Code Plugin

Install as a Claude Code plugin to get `/analyze-log` directly in your terminal:

```bash
npx skills add Moodswing9/backup-log-analyzer -g
```

This registers the skill and command globally so you can run `/analyze-log` from any Claude Code session.

| Command | What it does |
|:---|:---|
| `/analyze-log /var/log/ppdmwatch/ppdmwatch.log` | Analyse a single log file — severity, root cause, fix commands |
| `/analyze-log /var/log/before.log --diff /var/log/after.log` | Diff mode — compare two captures to surface regressions |

The skill auto-activates in Claude Code when you ask about log severity triage, PII redaction patterns, diff mode regression analysis, or the Next.js API route architecture — no command needed. Requires `ANTHROPIC_API_KEY` and `pip install anthropic`.

---

## Self-Hosting

The live version at [backup-log-analyzer.vercel.app](https://backup-log-analyzer.vercel.app) is open to use. To run your own instance:

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
git clone https://github.com/Moodswing9/backup-log-analyzer.git
cd backup-log-analyzer
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy

```bash
npx vercel --prod
npx vercel env add ANTHROPIC_API_KEY production
```

---

## Stack

| Layer | Technology |
|:---|:---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI | Claude Opus 4.7 (`claude-opus-4-7`) via Anthropic SDK |
| Streaming | Web `ReadableStream` → `response.body.getReader()` |
| Deployment | Vercel |

### Architecture

```
POST /api/analyze
  ↓ validates input (max 50k chars)
  ↓ streams claude-opus-4-7 response via ReadableStream
  ↓ client reads chunks with getReader(), appends to state
  ↓ react-markdown renders streamed output live
```

---

## Security & Privacy

| Protection | How it works |
|:---|:---|
| **PII redaction** | Bearer/Basic tokens, credential JSON fields (`"password": "..."` etc.), email addresses, and IPv4 octets are stripped server-side before the log text is forwarded to Claude |
| **Per-IP rate limiting** | 10 requests per minute per IP (sliding window, in-memory). Exceeding the limit returns HTTP 429 |
| **No persistence** | Logs are never stored, logged, or retained. Each request is passed to the Anthropic API and discarded after the streaming response completes |

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
