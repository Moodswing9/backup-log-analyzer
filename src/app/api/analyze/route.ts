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

export async function POST(request: Request) {
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
              content: `Analyze these logs:\n\n\`\`\`\n${logs}\n\`\`\``,
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
      } catch {
        controller.enqueue(
          enc.encode('\n\n**Error:** Analysis failed. Check your API key and try again.'),
        );
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
