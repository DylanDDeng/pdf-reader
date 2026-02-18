import { useState, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';
import { SettingsModal } from './components/settings/SettingsModal';
import { useLibrary } from './hooks/useLibrary';
import { useTabs, type Tab } from './hooks/useTabs';
import { useReaderSettings } from './hooks/useReaderSettings';
import { useReadingProgress } from './hooks/useReadingProgress';
import { getDocumentKey } from './utils/documentKey';
import type { ScannedFile, ImportResult as ImportResultType } from './types/library';
import type { ArxivImportOutcome } from './types/arxiv';

function App() {
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 使用标签页 hook 管理多文件
  const {
    tabs,
    activeTabId,
    openFile,
    closeTab,
    switchTab,
    updateTab,
  } = useTabs();
  const { settings, setOpenFileLocation, setArxivDownloadFolder } = useReaderSettings();
  const { getLastPage, setLastPage } = useReadingProgress();

  // Use the library hook for managing PDF library
  const {
    items: libraryItems,
    importProgress,
    importFiles,
    importFromArxiv,
    updateItem,
    toggleFavorite,
    removeItem,
    renameItem,
    lastSyncResult,
  } = useLibrary();

  const resolveInitialPage = useCallback((file: File | string): number => {
    if (settings.openFileLocation === 'first_page') {
      return 1;
    }

    const documentKey = getDocumentKey(file);
    const lastPage = getLastPage(documentKey);
    return lastPage ?? 1;
  }, [getLastPage, settings.openFileLocation]);

  // Handle opening a file from the library
  const handleOpenRecentFile = useCallback(
    (path: string) => {
      // 更新 lastOpened 时间戳
      const existingItem = libraryItems.find((item) => item.path === path);
      if (existingItem) {
        updateItem(existingItem.id, {
          lastOpened: new Date().toISOString(),
        });
      }
      
      // 打开文件到新标签页
      openFile(path, { initialPage: resolveInitialPage(path) });
      setActiveView('reader');
    },
    [libraryItems, updateItem, openFile, resolveInitialPage]
  );

  // 从 LibraryView 拖拽/选择打开文件
  const handleOpenFile = useCallback((file: File | string) => {
    openFile(file, { initialPage: resolveInitialPage(file) });
    setActiveView('reader');
  }, [openFile, resolveInitialPage]);

  // 关闭所有标签页时返回图书馆
  const handleTabClose = useCallback((tabId: string) => {
    closeTab(tabId);
    // 如果关闭后没有标签页了，返回图书馆视图
    if (tabs.length <= 1) {
      setActiveView('library');
    }
  }, [closeTab, tabs.length]);

  // Handle import folder from sidebar
  const [importTrigger, setImportTrigger] = useState(0);

  const handleImportFolder = useCallback(() => {
    setActiveView('library');
    setImportTrigger((prev) => prev + 1);
  }, []);

  // Handle importing files
  const handleImportFiles = useCallback(
    async (files: ScannedFile[]): Promise<ImportResultType> => {
      return await importFiles(files);
    },
    [importFiles]
  );

  const handleImportFromArxiv = useCallback(
    async (linkOrId: string): Promise<ArxivImportOutcome> => {
      return importFromArxiv(linkOrId, settings.arxivDownloadFolder);
    },
    [importFromArxiv, settings.arxivDownloadFolder]
  );

  const handleTabUpdate = useCallback((
    tabId: string,
    updates: Partial<Omit<Tab, 'id' | 'file' | 'fileName' | 'annotationKey'>>
  ) => {
    updateTab(tabId, updates);

    if (updates.currentPage === undefined || !Number.isFinite(updates.currentPage) || updates.currentPage < 1) {
      return;
    }

    const targetTab = tabs.find((tab) => tab.id === tabId);
    if (!targetTab) {
      return;
    }

    setLastPage(targetTab.annotationKey, updates.currentPage);
  }, [setLastPage, tabs, updateTab]);

  return (
    <div className="flex h-screen overflow-hidden archive-shell-bg">
      <Sidebar
        onImportFolder={handleImportFolder}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeView={activeView}
        onViewChange={setActiveView}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {activeView === 'library' ? (
          <LibraryView
            onOpenRecentFile={handleOpenRecentFile}
            onOpenFile={handleOpenFile}
            items={libraryItems}
            onImportFiles={handleImportFiles}
            onImportFromArxiv={handleImportFromArxiv}
            arxivDownloadFolder={settings.arxivDownloadFolder}
            onToggleFavorite={toggleFavorite}
            onRemoveItem={removeItem}
            onRenameItem={renameItem}
            importProgress={importProgress}
            lastSyncResult={lastSyncResult}
            triggerImport={importTrigger}
          />
        ) : (
          <Viewer
            tabs={tabs}
            activeTabId={activeTabId}
            onTabChange={switchTab}
            onTabClose={handleTabClose}
            onTabUpdate={handleTabUpdate}
          />
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onChangeOpenFileLocation={setOpenFileLocation}
        onChangeArxivDownloadFolder={setArxivDownloadFolder}
      />
    </div>
  );
}

export default App;
