import { describe, it, expect, beforeEach, vi } from 'vitest';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function makeIsRateLimited() {
  const log = new Map<string, number[]>();
  return (ip: string): boolean => {
    const now = Date.now();
    const timestamps = (log.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (timestamps.length >= MAX_REQUESTS) return true;
    log.set(ip, [...timestamps, now]);
    return false;
  };
}

describe('isRateLimited', () => {
  it('allows the first request', () => {
    const isLimited = makeIsRateLimited();
    expect(isLimited('1.2.3.4')).toBe(false);
  });

  it(`allows up to ${MAX_REQUESTS} requests within the window`, () => {
    const isLimited = makeIsRateLimited();
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(isLimited('1.2.3.4'), `request ${i + 1} should be allowed`).toBe(false);
    }
  });

  it(`blocks the ${MAX_REQUESTS + 1}th request`, () => {
    const isLimited = makeIsRateLimited();
    for (let i = 0; i < MAX_REQUESTS; i++) {
      isLimited('1.2.3.4');
    }
    expect(isLimited('1.2.3.4')).toBe(true);
  });

  it('tracks each IP independently', () => {
    const isLimited = makeIsRateLimited();
    for (let i = 0; i < MAX_REQUESTS; i++) {
      isLimited('10.0.0.1');
    }
    expect(isLimited('10.0.0.1')).toBe(true);
    expect(isLimited('10.0.0.2')).toBe(false);
  });

  it('allows requests again after the window expires', () => {
    vi.useFakeTimers();
    const isLimited = makeIsRateLimited();
    for (let i = 0; i < MAX_REQUESTS; i++) {
      isLimited('2.3.4.5');
    }
    expect(isLimited('2.3.4.5')).toBe(true);

    vi.advanceTimersByTime(WINDOW_MS + 1);

    expect(isLimited('2.3.4.5')).toBe(false);
    vi.useRealTimers();
  });

  it('counts only requests within the active window', () => {
    vi.useFakeTimers();
    const isLimited = makeIsRateLimited();

    // Make 5 requests at t=0
    for (let i = 0; i < 5; i++) {
      isLimited('3.4.5.6');
    }

    // Advance past the window — those 5 requests expire
    vi.advanceTimersByTime(WINDOW_MS + 1);

    // Make 5 more requests — should all be allowed (window is fresh)
    for (let i = 0; i < 5; i++) {
      expect(isLimited('3.4.5.6')).toBe(false);
    }

    vi.useRealTimers();
  });
});
