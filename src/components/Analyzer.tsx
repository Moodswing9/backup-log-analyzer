'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-950/60', text: 'text-red-400', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-950/60', text: 'text-orange-400', dot: 'bg-orange-500' },
  MEDIUM:   { bg: 'bg-yellow-950/60', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  LOW:      { bg: 'bg-green-950/60', text: 'text-green-400', dot: 'bg-green-500' },
  INFO:     { bg: 'bg-blue-950/60', text: 'text-blue-400', dot: 'bg-blue-500' },
};

function extractSeverity(markdown: string): string | null {
  const match = markdown.match(/##\s+Severity:\s*(CRITICAL|HIGH|MEDIUM|LOW|INFO)/i);
  return match ? match[1].toUpperCase() : null;
}

const PLACEHOLDER_SINGLE = `Paste your log output here. Examples:

2026-05-11 03:14:22 ERROR  [NetWorker] savefs: cannot connect to nsrexecd on client01.corp.local
2026-05-11 03:14:22 ERROR  [NetWorker] NSR peer information mismatch for host client01.corp.local
2026-05-11 03:14:23 WARN   [PPDM] Protection job FAILED: policy=k8s-daily assetId=a1b2c3d4
2026-05-11 03:14:25 ERROR  [PPDM] Elasticsearch cluster health: RED (unassigned shards=14)
2026-05-11 03:14:30 ERROR  [DD6900] DDBoost: filesystem usage 94% — threshold exceeded`;

const PLACEHOLDER_BEFORE = `Paste the REFERENCE log here (earlier / last known good run).

2026-05-10 02:01:15 INFO   [PPDM] Protection job started: policy=k8s-daily
2026-05-10 02:14:38 INFO   [PPDM] Protection job completed: 312 assets, 0 failed`;

const PLACEHOLDER_AFTER = `Paste the CURRENT log here (later / failing run).

2026-05-11 02:01:17 INFO   [PPDM] Protection job started: policy=k8s-daily
2026-05-11 03:14:25 ERROR  [PPDM] Protection job FAILED: policy=k8s-daily, failed=14
2026-05-11 03:14:26 ERROR  [PPDM] vProxy unreachable: vproxy01.corp.local (timeout after 30s)`;

function counterColor(len: number, limit: number): string {
  const pct = len / limit;
  if (pct >= 0.95) return 'text-red-400';
  if (pct >= 0.80) return 'text-yellow-400';
  return 'text-[#4a5568]';
}

type Mode = 'single' | 'diff';

export default function Analyzer() {
  const [mode, setMode]           = useState<Mode>('single');
  const [logText, setLogText]     = useState('');
  const [logBefore, setLogBefore] = useState('');
  const [logAfter, setLogAfter]   = useState('');
  const [analysis, setAnalysis]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setAnalysis('');
    setError('');
  }, []);

  const analyze = useCallback(async () => {
    const ready = mode === 'single'
      ? logText.trim().length > 0
      : logBefore.trim().length > 0 && logAfter.trim().length > 0;
    if (!ready) return;

    setLoading(true);
    setAnalysis('');
    setError('');

    try {
      const body = mode === 'diff'
        ? { mode: 'diff', logsBefore: logBefore, logsAfter: logAfter }
        : { logs: logText };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Analysis failed.');
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis(prev => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError('Network error — could not reach the analysis endpoint.');
    } finally {
      setLoading(false);
    }
  }, [mode, logText, logBefore, logAfter]);

  const isReady = mode === 'single'
    ? logText.trim().length > 0
    : logBefore.trim().length > 0 && logAfter.trim().length > 0;

  const severity = extractSeverity(analysis);
  const severityStyle = severity ? SEVERITY_STYLES[severity] : null;

  const textareaBase = `
    w-full resize-none rounded-lg border border-[#1a2030]
    bg-[#0e1318] p-4 font-mono text-sm text-[#c8d6e5]
    placeholder:text-[#2a3548] focus:border-purple-700 focus:outline-none
    focus:ring-1 focus:ring-purple-700/40 transition-colors
  `;

  return (
    <div className="flex flex-col gap-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#4a5568] mr-1">Mode:</span>
        <button
          onClick={() => switchMode('single')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
            mode === 'single'
              ? 'bg-purple-700 text-white'
              : 'border border-[#1a2030] bg-[#0e1318] text-[#4a5568] hover:text-[#c8d6e5]'
          }`}
        >
          Single Log
        </button>
        <button
          onClick={() => switchMode('diff')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
            mode === 'diff'
              ? 'bg-purple-700 text-white'
              : 'border border-[#1a2030] bg-[#0e1318] text-[#4a5568] hover:text-[#c8d6e5]'
          }`}
        >
          Diff Mode
        </button>
        {mode === 'diff' && (
          <span className="text-xs text-[#4a5568]">
            — paste two logs to identify regressions
          </span>
        )}
      </div>

      {/* Input + output grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log input(s) */}
        <div className="flex flex-col gap-3">
          {mode === 'single' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#c8d6e5]">Log Input</label>
                <span className={`text-xs ${counterColor(logText.length, 50000)}`}>
                  {logText.length.toLocaleString()} / 50,000 chars
                </span>
              </div>
              <textarea
                value={logText}
                onChange={e => setLogText(e.target.value)}
                placeholder={PLACEHOLDER_SINGLE}
                spellCheck={false}
                className={`h-96 lg:h-[480px] ${textareaBase}`}
              />
            </>
          ) : (
            <>
              {/* Reference log */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#c8d6e5]">
                  Reference Log
                  <span className="ml-2 text-xs text-[#4a5568] font-normal">earlier / last known good</span>
                </label>
                <span className={`text-xs ${counterColor(logBefore.length, 25000)}`}>
                  {logBefore.length.toLocaleString()} / 25,000
                </span>
              </div>
              <textarea
                value={logBefore}
                onChange={e => setLogBefore(e.target.value)}
                placeholder={PLACEHOLDER_BEFORE}
                spellCheck={false}
                className={`h-44 lg:h-[220px] ${textareaBase}`}
              />

              {/* Current log */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#c8d6e5]">
                  Current Log
                  <span className="ml-2 text-xs text-[#4a5568] font-normal">later / failing run</span>
                </label>
                <span className={`text-xs ${counterColor(logAfter.length, 25000)}`}>
                  {logAfter.length.toLocaleString()} / 25,000
                </span>
              </div>
              <textarea
                value={logAfter}
                onChange={e => setLogAfter(e.target.value)}
                placeholder={PLACEHOLDER_AFTER}
                spellCheck={false}
                className={`h-44 lg:h-[220px] ${textareaBase}`}
              />
            </>
          )}

          <button
            onClick={analyze}
            disabled={loading || !isReady}
            className="
              flex items-center justify-center gap-2 rounded-lg px-6 py-3
              bg-purple-700 hover:bg-purple-600 disabled:bg-[#1a2030]
              disabled:text-[#4a5568] text-white font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-purple-500/50
            "
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {mode === 'diff' ? 'Comparing…' : 'Analyzing…'}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.695-1.405 2.695H4.203c-1.436 0-2.405-1.695-1.405-2.695L4.2 15.3" />
                </svg>
                {mode === 'diff' ? 'Compare Logs' : 'Analyze Logs'}
              </>
            )}
          </button>
        </div>

        {/* Analysis output */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#c8d6e5]">
              {mode === 'diff' ? 'Diff Analysis' : 'Analysis'}
            </label>
            {severityStyle && (
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${severityStyle.bg} ${severityStyle.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${severityStyle.dot}`} />
                {severity}
              </span>
            )}
          </div>

          <div className="
            h-96 lg:h-[480px] overflow-y-auto rounded-lg border border-[#1a2030]
            bg-[#0e1318] p-4
          ">
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {!analysis && !loading && !error && (
              <p className="text-sm text-[#2a3548] italic">
                {mode === 'diff'
                  ? 'Paste both logs and click Compare — regressions, resolved issues, and changed patterns will stream here.'
                  : 'Analysis will stream here once you paste logs and click Analyze.'}
              </p>
            )}

            {loading && !analysis && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-[#4a5568]">
                  {mode === 'diff' ? 'Comparing' : 'Analyzing'}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:300ms]" />
              </div>
            )}

            {analysis && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="mt-4 mb-2 text-base font-semibold text-[#c8d6e5] first:mt-0">
                        {children}
                      </h2>
                    ),
                    p: ({ children }) => (
                      <p className="mb-3 text-sm leading-relaxed text-[#8a9ab8]">{children}</p>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 text-sm text-[#8a9ab8]">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-[#c8d6e5]">{children}</strong>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <code className="block">{children}</code>
                      ) : (
                        <code className="rounded bg-[#0a0f1a] px-1.5 py-0.5 font-mono text-xs text-purple-300">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="my-3 overflow-x-auto rounded-lg bg-[#0a0f1a] border border-[#1a2030] p-3 font-mono text-xs text-[#c8d6e5] leading-relaxed">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {analysis}
                </ReactMarkdown>
                {loading && (
                  <span className="inline-block w-px h-4 bg-purple-400 animate-pulse align-middle ml-0.5" />
                )}
              </div>
            )}
          </div>

          {analysis && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analysis).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="
                  flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2
                  border border-[#1a2030] bg-[#0e1318] hover:border-purple-700/60
                  text-sm text-[#4a5568] hover:text-[#c8d6e5] transition-colors
                "
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([analysis], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analysis-${new Date().toISOString().slice(0, 10)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="
                  flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2
                  border border-[#1a2030] bg-[#0e1318] hover:border-purple-700/60
                  text-sm text-[#4a5568] hover:text-[#c8d6e5] transition-colors
                "
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download .md
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
