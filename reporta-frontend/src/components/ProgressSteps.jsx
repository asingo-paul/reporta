import { useEffect, useState } from 'react';
import { Clock, CheckCircle, Download, TrendingUp, FileText, Loader } from 'lucide-react';

/**
 * Interactive, real-time progress tracker for a report being generated.
 *
 * Progress comes from the backend's live SSE feed (real pipeline stages:
 * queued -> pulling data -> analyzing -> building PDF -> done), so the
 * percentage reflects actual work — no fake timers. Each step gets its own
 * spinner/checkmark, the bar animates between stages, and an elapsed timer
 * shows how long the current run has taken.
 */
const STEPS = [
  { key: 'pending', label: 'Queued', icon: Clock, blurb: 'Warming up the report kitchen…' },
  { key: 'pulling_data', label: 'Pulling data', icon: Download, blurb: 'Gathering fresh numbers from your connected platforms…' },
  { key: 'analyzing', label: 'Analyzing trends', icon: TrendingUp, blurb: 'Our AI chef is seasoning the insights…' },
  { key: 'rendering', label: 'Building PDF', icon: FileText, blurb: 'Plating the final report — almost ready to serve…' },
  { key: 'completed', label: 'Report ready', icon: CheckCircle, blurb: 'All done! Your report is ready to share.' },
];

// Approximate completion percentage per stage — purely presentational, the
// stage transitions themselves are 100% real (SSE-driven).
const STAGE_PCT = { pending: 8, pulling_data: 35, analyzing: 65, rendering: 88, completed: 100 };

export default function ProgressSteps({ status, progressMessage, createdAt }) {
  const activeIndex = STEPS.findIndex((s) => s.key === status);
  const idx = activeIndex === -1 ? 0 : activeIndex;
  const pct = STAGE_PCT[status] ?? 5;
  const activeStep = STEPS[idx];

  // Elapsed timer for the current generation run.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!createdAt || status === 'completed' || status === 'failed') return undefined;
    const started = new Date(createdAt).getTime();
    if (Number.isNaN(started)) return undefined;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [createdAt, status]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedLabel = elapsed ? ` · ${mins}:${String(secs).padStart(2, '0')} elapsed` : '';

  return (
    <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      {/* Headline: spinner + live stage + percentage */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {status === 'completed' ? (
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400" />
          )}
          <p className="font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">
            {progressMessage || activeStep.blurb}
          </p>
        </div>
        <span className="text-2xl font-light text-blue-700 dark:text-blue-300 tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step list */}
      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < idx || status === 'completed';
          const isActive = i === idx && status !== 'completed';
          const isPending = !isDone && !isActive;

          return (
            <li key={step.key} className="flex items-center space-x-3">
              <span
                className={`flex items-center justify-center h-7 w-7 rounded-full border flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-600 dark:text-green-400'
                    : isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600'
                }`}
              >
                {isDone ? (
                  <CheckCircle className="h-5 w-5" />
                ) : isActive ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span
                className={`text-sm ${
                  isDone
                    ? 'text-green-700 dark:text-green-400'
                    : isActive
                      ? 'text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {step.label}
                {isDone && i < STEPS.length - 1 ? ' ✓' : ''}
              </span>
              {isActive && (
                <span className="text-xs text-blue-500/80 dark:text-blue-400/80 italic truncate">
                  {step.blurb}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {status !== 'completed' && status !== 'failed' && (
        <p className="mt-4 text-xs text-blue-600/70 dark:text-blue-400/70">
          This page updates live — no need to refresh.{elapsedLabel}
        </p>
      )}
    </div>
  );
}
