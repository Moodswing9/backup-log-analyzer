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

const PLACEHOLDER = `Paste your log output here. Examples:

2026-05-11 03:14:22 ERROR  [NetWorker] savefs: cannot connect to nsrexecd on client01.corp.local
2026-05-11 03:14:22 ERROR  [NetWorker] NSR peer information mismatch for host client01.corp.local
2026-05-11 03:14:23 WARN   [PPDM] Protection job FAILED: policy=k8s-daily assetId=a1b2c3d4
2026-05-11 03:14:25 ERROR  [PPDM] Elasticsearch cluster health: RED (unassigned shards=14)
2026-05-11 03:14:30 ERROR  [DD6900] DDBoost: filesystem usage 94% — threshold exceeded`;

export default function Analyzer() {
  const [logText, setLogText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = useCallback(async () => {
    if (!logText.trim()) return;

    setLoading(true);
    setAnalysis('');
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logText }),
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
  }, [logText]);

  const severity = extractSeverity(analysis);
  const severityStyle = severity ? SEVERITY_STYLES[severity] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Input + output grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Log input */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#c8d6e5]">
              Log Input
            </label>
            <span className="text-xs text-[#4a5568]">
              {logText.length.toLocaleString()} / 50,000 chars
            </span>
          </div>
          <textarea
            value={logText}
            onChange={e => setLogText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="
              h-96 lg:h-[480px] w-full resize-none rounded-lg border border-[#1a2030]
              bg-[#0e1318] p-4 font-mono text-sm text-[#c8d6e5]
              placeholder:text-[#2a3548] focus:border-purple-700 focus:outline-none
              focus:ring-1 focus:ring-purple-700/40 transition-colors
            "
          />
          <button
            onClick={analyze}
            disabled={loading || logText.trim().length === 0}
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
                Analyzing…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.695-1.405 2.695H4.203c-1.436 0-2.405-1.695-1.405-2.695L4.2 15.3" />
                </svg>
                Analyze Logs
              </>
            )}
          </button>
        </div>

        {/* Analysis output */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#c8d6e5]">
              Analysis
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
                Analysis will stream here once you paste logs and click Analyze.
              </p>
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
              </div>
            )}
          </div>

          {analysis && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(analysis).catch(() => {});
              }}
              className="
                flex items-center justify-center gap-2 rounded-lg px-4 py-2
                border border-[#1a2030] bg-[#0e1318] hover:border-purple-700/60
                text-sm text-[#4a5568] hover:text-[#c8d6e5] transition-colors
              "
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
