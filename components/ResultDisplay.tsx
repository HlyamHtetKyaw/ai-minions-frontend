'use client';

type ResultDisplayProps = {
  result: unknown;
  outputType: 'json' | 'blob' | 'text';
};

export default function ResultDisplay({ result, outputType }: ResultDisplayProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Result</h2>

      {outputType === 'json' && (
        <pre className="overflow-x-auto rounded-lg bg-gray-950 dark:bg-black p-4 text-xs text-green-400 leading-relaxed">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      {outputType === 'text' && (
        <textarea
          readOnly
          value={typeof result === 'string' ? result : String(result)}
          rows={12}
          className="w-full rounded-lg border border-card-border bg-background px-3 py-2 font-mono text-xs focus:outline-none resize-y"
        />
      )}

      {outputType === 'blob' && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">Your file is ready to download.</p>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg border border-card-border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download file
          </button>
          <p className="text-xs text-muted">(Download disabled in mock mode)</p>
        </div>
      )}
    </div>
  );
}
