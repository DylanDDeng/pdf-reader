/**
 * ImportResult - Displays import results after completion
 */

import { useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ImportResult as ImportResultType } from '../../types/library';

interface ImportResultProps {
  result: ImportResultType;
  onClose: () => void;
  onViewLibrary?: () => void;
}

export function ImportResult({ result, onClose, onViewLibrary }: ImportResultProps) {
  const [showErrors, setShowErrors] = useState(false);

  const { success, skipped, failed, errors } = result;
  const total = success + skipped + failed;

  const hasIssues = failed > 0 || skipped > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 ${
          hasIssues
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-green-50 dark:bg-green-900/20'
        }`}
      >
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          <span className="text-sm font-medium text-slate-800 dark:text-white">
            Import {hasIssues ? 'Completed with Issues' : 'Complete'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          {/* Success */}
          <div className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-500 mb-1" />
            <span className="text-lg font-semibold text-green-600 dark:text-green-400">
              {success}
            </span>
            <span className="text-xs text-green-600 dark:text-green-400">Imported</span>
          </div>

          {/* Skipped */}
          <div className="flex flex-col items-center p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-slate-400 mb-1" />
            <span className="text-lg font-semibold text-slate-600 dark:text-slate-300">
              {skipped}
            </span>
            <span className="text-xs text-slate-500">Skipped</span>
          </div>

          {/* Failed */}
          <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-500 mb-1" />
            <span className="text-lg font-semibold text-red-600 dark:text-red-400">
              {failed}
            </span>
            <span className="text-xs text-red-600 dark:text-red-400">Failed</span>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
            {success > 0 && (
              <div
                className="h-full bg-green-500"
                style={{ width: `${(success / total) * 100}%` }}
              />
            )}
            {skipped > 0 && (
              <div
                className="h-full bg-slate-400"
                style={{ width: `${(skipped / total) * 100}%` }}
              />
            )}
            {failed > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${(failed / total) * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Error Details */}
        {errors.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              {showErrors ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </button>

            {showErrors && (
              <div className="mt-2 max-h-32 overflow-auto text-xs bg-red-50 dark:bg-red-900/10 rounded-lg p-2 space-y-1">
                {errors.map((error, index) => (
                  <div key={index} className="text-red-600 dark:text-red-400">
                    <span className="font-medium">{error.filePath.split('/').pop()}:</span>{' '}
                    {error.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info about skipped */}
        {skipped > 0 && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {skipped} file{skipped !== 1 ? 's were' : ' was'} skipped because they already
            exist in your library
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          Close
        </button>
        {onViewLibrary && success > 0 && (
          <button
            onClick={onViewLibrary}
            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm transition-colors"
          >
            View Library
          </button>
        )}
      </div>
    </div>
  );
}
