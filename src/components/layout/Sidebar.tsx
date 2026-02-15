import { FileText, FolderPlus, Clock, Star, Settings, Moon, Sun, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface SidebarProps {
  onImportFolder?: () => void;
  activeView: 'library' | 'reader';
  onViewChange: (view: 'library' | 'reader') => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ 
  onImportFolder, 
  activeView, 
  onViewChange,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside 
      className={`bg-white dark:bg-background-dark border-r border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center px-3 border-b border-slate-200 dark:border-slate-700">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        {!isCollapsed && (
          <span className="ml-3 font-semibold text-slate-800 dark:text-white truncate">
            DocuFlow
          </span>
        )}
      </div>

      {/* Import Folder Button */}
      <div className="p-2">
        {onImportFolder && (
          <button
            onClick={onImportFolder}
            className="w-full flex items-center justify-center lg:justify-start gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Import Folder</span>}
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
          <FileText className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Library</span>}
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Clock className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Recent</span>}
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Star className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Favorites</span>}
        </button>
      </nav>

      {/* Collapse Toggle Button */}
      <div className="px-2 pb-2">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5" />
              <span className="text-sm font-medium">收起</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 shrink-0" />
          ) : (
            <Moon className="w-5 h-5 shrink-0" />
          )}
          {!isCollapsed && (
            <span className="text-sm font-medium">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
