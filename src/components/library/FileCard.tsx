import { FileText, Clock } from 'lucide-react';

interface FileCardProps {
  name: string;
  lastOpened?: string;
  onClick: () => void;
}

export function FileCard({ name, lastOpened, onClick }: FileCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-200 border border-slate-200 dark:border-slate-700 group"
    >
      {/* PDF Icon */}
      <div className="w-full aspect-[3/4] bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
        <FileText className="w-12 h-12 text-red-500" />
      </div>

      {/* File Name */}
      <h3 className="font-medium text-slate-800 dark:text-white text-sm truncate mb-1">
        {name}
      </h3>

      {/* Last Opened */}
      {lastOpened && (
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{lastOpened}</span>
        </div>
      )}
    </div>
  );
}
