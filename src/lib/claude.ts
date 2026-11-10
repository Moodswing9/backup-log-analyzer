import type Anthropic from '@anthropic-ai/sdk';

// Claude Opus 5.5 always thinks; `effort` sets how much. Measured on two real
// NetWorker/PPDM logs, `low` matched Opus 4.7's cost and first-token latency
// with the same diagnoses, while the default (`medium`) doubled the cost and
// delayed the first words by 15-20 s. Thinking shares max_tokens with the report.
// On a refusal, `fallbacks: 'default'` re-runs the request on a fallback model.
export const CLAUDE_REQUEST = {
  model: 'claude-opus-5-5',
  max_tokens: 8000,
  output_config: { effort: 'low' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
} satisfies Pick<
  Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  'model' | 'max_tokens' | 'output_config' | 'betas' | 'fallbacks'
>;

export const REFUSAL_MESSAGE =
  '**Error:** Claude declined to analyze this log. Remove unrelated or sensitive content and try again.';

/** Text of the report: every text block, skipping thinking and fallback blocks. */
export function reportText(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}
