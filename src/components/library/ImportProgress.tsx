/**
 * ImportProgress - Displays import progress bar and status
 */

import { X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { ImportProgress as ImportProgressType } from '../../types/library';

interface ImportProgressProps {
  progress: ImportProgressType;
  onCancel?: () => void;
}

export function ImportProgress({ progress, onCancel }: ImportProgressProps) {
  const { current, total, currentFile, status } = progress;

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const getStatusIcon = () => {
    switch (status) {
      case 'scanning':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'importing':
        return <FileText className="w-5 h-5 text-primary" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'scanning':
        return 'Scanning directory...';
      case 'importing':
        return `Importing ${current} of ${total}...`;
      case 'completed':
        return 'Import completed!';
      case 'error':
        return 'Import failed';
      default:
        return '';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-slate-800 dark:text-white">
            {getStatusText()}
          </span>
        </div>
        {onCancel && status !== 'completed' && status !== 'error' && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              status === 'error'
                ? 'bg-red-500'
                : status === 'completed'
                ? 'bg-green-500'
                : 'bg-primary'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Current File */}
        {currentFile && status === 'importing' && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            {currentFile}
          </div>
        )}

        {/* Stats */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {current} / {total} files
          </span>
          <span>{percentage}%</span>
        </div>
      </div>
    </div>
  );
}
