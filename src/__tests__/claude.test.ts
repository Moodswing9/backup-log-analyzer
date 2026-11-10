import { describe, expect, it } from 'vitest';
import { CLAUDE_REQUEST, reportText } from '@/lib/claude';

describe('CLAUDE_REQUEST', () => {
  it('targets Claude Opus 5.5 at low effort', () => {
    expect(CLAUDE_REQUEST.model).toBe('claude-opus-5-5');
    expect(CLAUDE_REQUEST.output_config.effort).toBe('low');
  });

  it('leaves room for thinking plus a full report', () => {
    expect(CLAUDE_REQUEST.max_tokens).toBeGreaterThanOrEqual(8000);
  });

  it('sends no thinking or sampling settings the model rejects', () => {
    expect(CLAUDE_REQUEST).not.toHaveProperty('thinking');
    expect(CLAUDE_REQUEST).not.toHaveProperty('temperature');
  });

  it('opts into refusal fallbacks with the matching beta', () => {
    expect(CLAUDE_REQUEST.fallbacks).toBe('default');
    expect(CLAUDE_REQUEST.betas).toContain('server-side-fallback-2026-07-01');
  });
});

describe('reportText', () => {
  it('skips a leading thinking block instead of returning it or nothing', () => {
    const content = [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '## Severity: HIGH' },
    ];
    expect(reportText(content)).toBe('## Severity: HIGH');
  });

  it('joins every text block and ignores fallback blocks', () => {
    const content = [
      { type: 'text', text: 'part one, ' },
      { type: 'fallback' },
      { type: 'text', text: 'part two' },
    ];
    expect(reportText(content)).toBe('part one, part two');
  });
});
