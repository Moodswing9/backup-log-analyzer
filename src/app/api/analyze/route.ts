import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a senior infrastructure engineer specializing in backup and data protection systems (Dell EMC NetWorker, PowerProtect Data Manager, Veeam, Commvault, and generic Linux/Windows servers).

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

If no issues are found, say so clearly and assign INFO severity.`;

// ── PII redaction ─────────────────────────────────────────────────────────────

function redactLogPII(logs: string): string {
  return logs
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[A-Za-z0-9+/]+=*/gi, 'Basic [REDACTED]')
    .replace(
      /("(?:password|passwd|secret|token|api_key|apikey|access_key|private_key)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.x.x');
}

// ── Per-IP rate limiting ──────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ipRequestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequestLog.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  ipRequestLog.set(ip, [...timestamps, now]);
  return false;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Rate limit exceeded. Please wait a minute before trying again.' },
      { status: 429 },
    );
  }

  let body: { logs?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const logs = body.logs;
  if (typeof logs !== 'string' || logs.trim().length === 0) {
    return Response.json({ error: 'No log content provided.' }, { status: 400 });
  }
  if (logs.length > 50_000) {
    return Response.json(
      { error: 'Log content too large. Maximum 50,000 characters.' },
      { status: 400 },
    );
  }

  const redactedLogs = redactLogPII(logs);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const msgStream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analyze these logs:\n\n\`\`\`\n${redactedLogs}\n\`\`\``,
            },
          ],
        });

        for await (const chunk of msgStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(enc.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.message.includes('429')
            ? '\n\n**Error:** API rate limit reached. Please try again in a moment.'
            : '\n\n**Error:** Analysis failed. Check your API key and try again.';
        controller.enqueue(enc.encode(msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
