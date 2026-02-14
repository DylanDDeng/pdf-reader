import { useState, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';
import { useLibrary } from './hooks/useLibrary';
import { useTabs } from './hooks/useTabs';
import type { ScannedFile, ImportResult as ImportResultType } from './types/library';

function App() {
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 使用标签页 hook 管理多文件
  const {
    tabs,
    activeTabId,
    openFile,
    closeTab,
    switchTab,
  } = useTabs();

  // Use the library hook for managing PDF library
  const {
    items: libraryItems,
    importProgress,
    importFiles,
    updateItem,
    toggleFavorite,
    removeItem,
    renameItem,
    lastSyncResult,
  } = useLibrary();

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
      openFile(path);
      setActiveView('reader');
    },
    [libraryItems, updateItem, openFile]
  );

  // 从 LibraryView 拖拽/选择打开文件
  const handleOpenFile = useCallback((file: File | string) => {
    openFile(file);
    setActiveView('reader');
  }, [openFile]);

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

  return (
    <div className="flex h-screen bg-[#f6f7f8] dark:bg-background-dark">
      <Sidebar
        onImportFolder={handleImportFolder}
        activeView={activeView}
        onViewChange={setActiveView}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {activeView === 'library' ? (
        <LibraryView
          onOpenRecentFile={handleOpenRecentFile}
          onOpenFile={handleOpenFile}
          items={libraryItems}
          onImportFiles={handleImportFiles}
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
          onOpenFile={handleOpenFile}
        />
      )}
    </div>
  );
}

export default App;
