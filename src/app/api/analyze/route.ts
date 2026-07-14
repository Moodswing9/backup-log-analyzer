import Anthropic from '@anthropic-ai/sdk';
import { redactLogPII } from '@/lib/redact';
import { classifyLog, type TaxonomyMatch } from '@/lib/error-taxonomy';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
});

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

const DIFF_SYSTEM_PROMPT = `You are a senior infrastructure engineer specializing in backup and data protection systems (Dell EMC NetWorker, PowerProtect Data Manager, Veeam, Commvault, and generic Linux/Windows servers).

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

If logs are identical or no regressions found, say so clearly and assign INFO severity.`;

// ── Taxonomy formatter ────────────────────────────────────────────────────────

function formatTaxonomyResult(match: TaxonomyMatch): string {
  const fixBlock = match.fixCommands.map((cmd) => cmd).join('\n');
  return [
    `## Severity: ${match.severity}`,
    '',
    '## Summary',
    `Matched known error pattern **${match.errorCode}** (${match.title}). This is a high-confidence taxonomy match — no AI inference required.`,
    '',
    '## Issues Detected',
    `1. **[${match.errorCode}] ${match.title}** — deterministic pattern match on known ${match.product} error signature.`,
    '',
    '## Root Causes',
    match.rootCause,
    '',
    '## Recommended Actions',
    '```',
    fixBlock,
    '```',
    '',
    '## Prevention',
    'Add this error pattern to your monitoring alerts so future occurrences are caught before jobs fail.',
    '',
    `---`,
    `*Classified by offline error taxonomy. Error code: \`${match.errorCode}\`. Product: ${match.product}. Confidence: high — no API call used.*`,
  ].join('\n');
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

  let body: { logs?: unknown; logsBefore?: unknown; logsAfter?: unknown; mode?: unknown; files?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Batch mode ─────────────────────────────────────────────────────────────
  if (body.mode === 'batch') {
    if (!Array.isArray(body.files) || body.files.length === 0) {
      return Response.json({ error: 'Batch mode requires a non-empty files array.' }, { status: 400 });
    }
    if (body.files.length > 5) {
      return Response.json({ error: 'Batch mode supports a maximum of 5 files.' }, { status: 400 });
    }
    // Validate each entry
    for (const f of body.files) {
      if (typeof f !== 'object' || f === null || typeof (f as Record<string, unknown>).name !== 'string' || typeof (f as Record<string, unknown>).content !== 'string') {
        return Response.json({ error: 'Each file must have a string name and string content.' }, { status: 400 });
      }
    }

    const files = body.files as Array<{ name: string; content: string }>;

    // Process each file: taxonomy fast-path then Claude
    const fileSections: string[] = [];
    for (const file of files) {
      const content = file.content;
      const taxonomyResult = classifyLog(content);
      if (taxonomyResult.matched && taxonomyResult.match) {
        fileSections.push(`## File: ${file.name}\n\n${formatTaxonomyResult(taxonomyResult.match)}`);
      } else {
        // Call Claude for this file
        const userContent = `Analyze these logs:\n\n\`\`\`\n${redactLogPII(content)}\n\`\`\``;
        let fileAnalysis = '';
        try {
          const msg = await client.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 2048,
            system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any,
            messages: [{ role: 'user', content: userContent }],
          });
          const block = msg.content[0];
          fileAnalysis = block.type === 'text' ? block.text : '';
        } catch (err) {
          fileAnalysis = err instanceof Error && err.message.includes('429')
            ? '**Error:** API rate limit reached. Please try again in a moment.'
            : '**Error:** Analysis failed. Check your API key and try again.';
        }
        fileSections.push(`## File: ${file.name}\n\n${fileAnalysis}`);
      }
    }

    const consolidated = `# Batch Analysis Results\n\n${fileSections.join('\n\n---\n\n')}`;
    return new Response(consolidated, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const isDiff = body.mode === 'diff';

  let systemPrompt: string;
  let userContent: string;

  if (isDiff) {
    const logsBefore = body.logsBefore;
    const logsAfter = body.logsAfter;
    if (typeof logsBefore !== 'string' || logsBefore.trim().length === 0) {
      return Response.json({ error: 'No reference log content provided.' }, { status: 400 });
    }
    if (typeof logsAfter !== 'string' || logsAfter.trim().length === 0) {
      return Response.json({ error: 'No current log content provided.' }, { status: 400 });
    }
    if (logsBefore.length > 25_000) {
      return Response.json({ error: 'Reference log too large. Maximum 25,000 characters per log.' }, { status: 400 });
    }
    if (logsAfter.length > 25_000) {
      return Response.json({ error: 'Current log too large. Maximum 25,000 characters per log.' }, { status: 400 });
    }
    systemPrompt = DIFF_SYSTEM_PROMPT;
    userContent = `REFERENCE LOG (earlier/healthy):\n\`\`\`\n${redactLogPII(logsBefore)}\n\`\`\`\n\nCURRENT LOG (later/failing):\n\`\`\`\n${redactLogPII(logsAfter)}\n\`\`\``;
  } else {
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
    // Taxonomy fast-path: check before spending an AI call
    const taxonomyResult = classifyLog(logs);
    if (taxonomyResult.matched && taxonomyResult.match) {
      const markdown = formatTaxonomyResult(taxonomyResult.match);
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Classification-Source': 'taxonomy',
          'X-Error-Code': taxonomyResult.match.errorCode,
        },
      });
    }

    systemPrompt = SYSTEM_PROMPT;
    userContent = `Analyze these logs:\n\n\`\`\`\n${redactLogPII(logs)}\n\`\`\``;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const msgStream = client.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 2048,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as any,
          messages: [
            {
              role: 'user',
              content: userContent,
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
