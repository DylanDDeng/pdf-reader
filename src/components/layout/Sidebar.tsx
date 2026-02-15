import { FolderPlus, Settings, Moon, Sun, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

  const renderNavItem = (
    label: string,
    active: boolean,
    iconShape: 'circle' | 'square',
    onClick?: () => void
  ) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-2.5 transition-colors ${
        active ? 'text-[var(--archive-rust)] opacity-100' : 'text-[var(--archive-ink-grey)] opacity-80 hover:opacity-100'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 border border-current ${
          iconShape === 'circle' ? 'rounded-full' : 'rounded-[2px]'
        }`}
      />
      {!isCollapsed && (
        <span className="text-[12px] font-semibold tracking-[0.08em] uppercase">{label}</span>
      )}
    </button>
  );

  return (
    <aside
      className={`archive-library shrink-0 overflow-hidden flex flex-col transition-all duration-300 border-r border-black/10 border-dashed bg-white/55 backdrop-blur-[2px] ${
        isCollapsed ? 'w-20 px-3 py-6' : 'w-[260px] px-6 py-8'
      }`}
    >
      <div className="flex flex-col h-full">
        <div>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} mb-10`}>
            <div className="h-7 w-7 rounded-full border-2 border-[var(--archive-ink-black)] grid place-items-center">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--archive-ink-black)]" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-[30px] leading-none tracking-tight text-[var(--archive-ink-black)]">
                ARCHIVE.PDF
              </span>
            )}
          </div>

          {onImportFolder && (
            <button
              onClick={onImportFolder}
              className={`w-full mb-8 border border-black/15 border-dashed rounded-xl transition-colors hover:bg-black/5 ${
                isCollapsed ? 'h-10 grid place-items-center' : 'px-3 py-2.5 flex items-center gap-2'
              }`}
              title="Import Folder"
            >
              <FolderPlus className="w-4 h-4" />
              {!isCollapsed && (
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">
                  Import Folder
                </span>
              )}
            </button>
          )}

          <nav className={`${isCollapsed ? 'px-1' : 'px-1'} space-y-2`}>
            {renderNavItem('All Documents', activeView === 'library', 'circle', () => onViewChange('library'))}
            {renderNavItem('Favorites', false, 'square')}
            {renderNavItem('Recent', activeView === 'reader', 'circle', () => onViewChange('reader'))}
            {renderNavItem('Shared', false, 'square')}
          </nav>
        </div>

        <div className="mt-auto">
          {!isCollapsed && (
            <div className="mb-6">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--archive-ink-grey)]">Storage</span>
              <div className="h-1.5 w-full mt-2 bg-black/10 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-[64%] bg-[var(--archive-rust)]" />
              </div>
              <div className="text-right text-[11px] mt-1.5 text-[var(--archive-ink-grey)] font-semibold">64% Used</div>
            </div>
          )}

          <div className="border-t border-black/10 border-dashed pt-4 space-y-2">
            <button
              onClick={toggleTheme}
              className={`w-full rounded-xl transition-colors hover:bg-black/5 ${
                isCollapsed ? 'h-10 grid place-items-center' : 'px-3 py-2 flex items-center gap-2'
              }`}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {!isCollapsed && (
                <span className="text-[12px] font-semibold tracking-[0.08em] uppercase">
                  {theme === 'dark' ? 'Light' : 'Dark'} Mode
                </span>
              )}
            </button>

            <button
              className={`w-full rounded-xl transition-colors hover:bg-black/5 ${
                isCollapsed ? 'h-10 grid place-items-center' : 'px-3 py-2 flex items-center gap-2'
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
              {!isCollapsed && (
                <span className="text-[12px] font-semibold tracking-[0.08em] uppercase">Settings</span>
              )}
            </button>

            <button
              onClick={onToggleCollapse}
              className={`w-full rounded-xl transition-colors hover:bg-black/5 ${
                isCollapsed ? 'h-10 grid place-items-center' : 'px-3 py-2 flex items-center gap-2'
              }`}
              title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              {!isCollapsed && (
                <span className="text-[12px] font-semibold tracking-[0.08em] uppercase">Collapse</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
