import { AlertTriangle } from 'lucide-react';

/**
 * Reusable confirmation dialog for destructive/major actions (deleting a
 * client or report, revoking a connection). Deliberately a real modal rather
 * than the native `confirm()`: it matches the app's styling, can carry rich
 * copy (consequences of the action), and keeps the "are you sure?" step
 * consistent across every mutating flow.
 *
 * Props:
 *   - title:            heading text (e.g. "Delete Client")
 *   - message:          JSX explaining what will happen
 *   - confirmLabel:     confirm button text (default "Confirm")
 *   - onConfirm:        called when the user confirms (may be async)
 *   - onCancel:         called when the user cancels / dismisses
 *   - busy:             disables both buttons while the action runs
 *   - danger:           red confirm button styling (default true)
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  busy = false,
  danger = true,
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-50 border border-gray-200 dark:border-gray-800 rounded max-w-md w-full p-6 animate-slide-up">
        <div className="flex items-start space-x-3 mb-4">
          {danger && (
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <h3 className="text-xl font-light tracking-wide text-gray-900 dark:text-white uppercase">
            {title}
          </h3>
        </div>
        <div className="text-gray-600 dark:text-gray-400 mb-6">{message}</div>
        <div className="flex space-x-3">
          <button onClick={onCancel} className="btn btn-secondary flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`btn flex-1 inline-flex items-center justify-center ${
              danger
                ? 'border border-red-600 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'btn-primary'
            }`}
          >
            {busy ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Working...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
