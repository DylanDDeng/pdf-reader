import { FileText, FolderOpen, FolderPlus, Clock, Star, Settings, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface SidebarProps {
  onOpenFile: () => void;
  onImportFolder?: () => void;
  activeView: 'library' | 'reader';
  onViewChange: (view: 'library' | 'reader') => void;
}

export function Sidebar({ onOpenFile, onImportFolder, activeView, onViewChange }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-16 lg:w-64 bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <span className="hidden lg:block ml-3 font-semibold text-slate-800 dark:text-white">
          DocuFlow
        </span>
      </div>

      {/* Open File Button */}
      <div className="p-2 lg:p-3 space-y-2">
        <button
          onClick={onOpenFile}
          className="w-full flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors font-medium text-sm"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden lg:block">Open File</span>
        </button>

        {onImportFolder && (
          <button
            onClick={onImportFolder}
            className="w-full flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl transition-colors font-medium text-sm"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden lg:block">Import Folder</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        <button
          onClick={() => onViewChange('library')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
            activeView === 'library'
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="hidden lg:block text-sm font-medium">Library</span>
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Clock className="w-5 h-5" />
          <span className="hidden lg:block text-sm font-medium">Recent</span>
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Star className="w-5 h-5" />
          <span className="hidden lg:block text-sm font-medium">Favorites</span>
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          <span className="hidden lg:block text-sm font-medium">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden lg:block text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
