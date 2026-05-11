import Analyzer from '@/components/Analyzer';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a2030] px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-purple-400 font-bold tracking-tight text-lg">
              backup-log-analyzer
            </span>
            <span className="hidden sm:inline-block rounded-full border border-purple-900/60 bg-purple-950/40 px-2 py-0.5 text-xs text-purple-400">
              powered by Claude
            </span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-[#4a5568]">
            <a
              href="https://github.com/Moodswing9"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#c8d6e5] transition-colors"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-[#1a2030] bg-[#0a0d13] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Backup Log Analyzer
          </h1>
          <p className="mt-2 text-sm text-[#4a5568] max-w-2xl">
            Paste any log output — PPDM, NetWorker, Data Domain, Veeam, or generic syslog.
            Claude identifies errors, root causes, and copy-pasteable fix commands in seconds.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {['PPDM', 'NetWorker', 'Data Domain', 'Veeam', 'Linux syslog', 'Windows Event Log'].map(tag => (
              <span
                key={tag}
                className="rounded border border-[#1a2030] px-2 py-0.5 text-xs text-[#4a5568]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <Analyzer />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a2030] px-6 py-4 text-center text-xs text-[#2a3548]">
        No logs are stored. Analysis runs via the Anthropic API and is discarded after the response.
      </footer>
    </div>
  );
}
