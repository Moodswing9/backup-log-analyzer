---
description: Analyze a local backup or infrastructure log file — severity, root causes, and fix commands via Claude Haiku 4.5. Supports diff mode to compare two captures.
argument-hint: "<log-file-path> [--diff <second-log-file>]"
allowed-tools: ["Bash", "Read"]
---

The user wants to analyze: $ARGUMENTS

**Execute every step yourself using your tools. Do not ask the user to run commands.**

## Step 1 — Parse arguments

From `$ARGUMENTS` extract:
- **Primary log file** — first positional argument (required). May be an absolute path or relative to cwd.
- **`--diff <path>`** — if present, a second log file for regression comparison (REFERENCE vs CURRENT).

If no file path is provided, stop immediately:
> "Provide a log file path — example: `/analyze-log /var/log/ppdmwatch/ppdmwatch.log`"

## Step 2 — Verify the file(s) exist

Use the Read tool to open the primary log file. If it does not exist, stop with the exact path and error — do not guess alternatives.

If `--diff` was passed, also verify the second file exists with the Read tool.

Note the character count of each file. Log files are chronological — the most recent (and most relevant) entries are at the end. Apply this strategy:
- **Single mode:** if the file exceeds 50,000 characters, keep the **last** 50,000 characters (tail). Note the truncation: *"File was NNN chars — analyzing the most recent 50,000 chars."*
- **Diff mode:** if either file exceeds 25,000 characters, keep the last 25,000 characters of that file.
- If a file is very large (> 500,000 chars / ~500 KB), recommend the user pre-filter with `tail -n 2000 <file>` and re-run rather than feeding a blind truncation.

## Step 3 — Run PII redaction and call Claude Haiku 4.5

Use the Bash tool to run the following Python script. Substitute the actual file paths from Step 1 into `PRIMARY` and `DIFF` (set `DIFF = None` when not in diff mode):

```bash
python3 - << 'PYEOF'
import re, sys
import anthropic

PRIMARY = "/path/to/primary.log"   # ← substitute actual path
DIFF    = None                      # ← substitute actual path or leave None

SYSTEM_SINGLE = """You are a senior infrastructure engineer specializing in backup and data protection systems (Dell EMC NetWorker, PowerProtect Data Manager, Veeam, Commvault, and generic Linux/Windows servers).

Analyze the provided log output and return a structured markdown report. Be precise and actionable.

Always use this exact structure:

## Severity: [CRITICAL | HIGH | MEDIUM | LOW | INFO]

## Summary
2–3 sentence overview of what was found.

## Issues Detected
Numbered list of specific errors or warnings identified, citing the exact log line or pattern that triggered each finding.

## Root Causes
For each issue, the most likely root cause based on the log evidence.

## Recommended Actions
Specific, copy-pasteable remediation steps. Use fenced code blocks for all shell commands.

## Prevention
1–2 sentences on how to avoid recurrence.

If no issues are found, say so clearly and assign INFO severity."""

SYSTEM_DIFF = """You are a senior infrastructure engineer specializing in backup and data protection systems (Dell EMC NetWorker, PowerProtect Data Manager, Veeam, Commvault, and generic Linux/Windows servers).

You are given two log captures: a REFERENCE log (earlier/healthy run) and a CURRENT log (later/failing run). Compare them and identify exactly what changed.

Always use this exact structure:

## Severity: [CRITICAL | HIGH | MEDIUM | LOW | INFO]

## Summary
2–3 sentence overview of what regressed, resolved, or changed between the two captures.

## Regressions (New in Current)
Errors or warnings that appear in the CURRENT log but were absent in the REFERENCE. Cite the exact line or pattern. Mark the most critical with **[CRITICAL]**.

## Resolved (Fixed Since Reference)
Errors or warnings present in the REFERENCE that no longer appear in the CURRENT. Note these as positive changes.

## Changed Patterns
Issues present in both logs but with different frequency, severity, or error code. Note whether they worsened or improved.

## Root Cause of Top Regression
One paragraph diagnosing the most critical new issue, citing specific log evidence from both captures.

## Recommended Actions
Specific, copy-pasteable remediation steps targeting the top regression. Use fenced code blocks for all shell commands.

If logs are identical or no regressions found, say so clearly and assign INFO severity."""

def redact(text):
    text = re.sub(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer [REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'Basic\s+[A-Za-z0-9+/]+=*', 'Basic [REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'("(?:password|passwd|secret|token|api_key|apikey|access_key|private_key)"\s*:\s*)"[^"]*"', r'\1"[REDACTED]"', text, flags=re.IGNORECASE)
    text = re.sub(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    text = re.sub(r'\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b', r'\1.x.x', text)
    return text

with open(PRIMARY) as f:
    raw = f.read()
primary = redact(raw[-50000:] if len(raw) > 50000 else raw)

client = anthropic.Anthropic()

if DIFF:
    with open(DIFF) as f:
        raw2 = f.read()
    secondary = redact(raw2[-25000:] if len(raw2) > 25000 else raw2)
    system = SYSTEM_DIFF
    user_content = (
        f'REFERENCE LOG (earlier/healthy):\n```\n{primary}\n```\n\n'
        f'CURRENT LOG (later/failing):\n```\n{secondary}\n```'
    )
else:
    system = SYSTEM_SINGLE
    user_content = f'Analyze these logs:\n\n```\n{primary}\n```'

with client.messages.stream(
    model='claude-haiku-4-5-20251001',
    max_tokens=2048,
    system=system,
    messages=[{'role': 'user', 'content': user_content}],
) as stream:
    for text in stream.text_stream:
        print(text, end='', flush=True)
print()
PYEOF
```

## Step 4 — Handle errors

| Error | Response |
|---|---|
| `AuthenticationError` | "Set your API key: `export ANTHROPIC_API_KEY=sk-ant-…`" |
| `ModuleNotFoundError: anthropic` | "Install the SDK: `pip install anthropic`" |
| `FileNotFoundError` | Report the exact path — do not guess alternatives |
| Any other exception | Print the full traceback so the user can diagnose |
