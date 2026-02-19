import { useState, useCallback, useMemo } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';
import { SettingsModal } from './components/settings/SettingsModal';
import { useLibrary } from './hooks/useLibrary';
import { useTabs, type Tab } from './hooks/useTabs';
import { useReaderSettings } from './hooks/useReaderSettings';
import { useReadingProgress } from './hooks/useReadingProgress';
import { useZoomMemory } from './hooks/useZoomMemory';
import { getDocumentKey } from './utils/documentKey';
import type { ScannedFile, ImportResult as ImportResultType } from './types/library';
import type { ArxivImportOutcome } from './types/arxiv';
import type { DefaultZoomMode } from './types/settings';

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
  const { settings, setOpenFileLocation, setDefaultZoomMode, setArxivDownloadFolder } = useReaderSettings();
  const { getLastPage, setLastPage } = useReadingProgress();
  const { getLastScale, setLastScale } = useZoomMemory();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs]
  );

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

  const resolveInitialZoom = useCallback((file: File | string) => {
    if (settings.defaultZoomMode === 'fit_width') {
      return {
        initialScale: 1,
        initialZoomMode: 'fit_width' as const,
      };
    }

    if (settings.defaultZoomMode === 'fixed_100') {
      return {
        initialScale: 1,
        initialZoomMode: 'custom' as const,
      };
    }

    const documentKey = getDocumentKey(file);
    const rememberedScale = getLastScale(documentKey) ?? 1;
    return {
      initialScale: rememberedScale,
      initialZoomMode: 'custom' as const,
    };
  }, [getLastScale, settings.defaultZoomMode]);

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
      const initialPage = resolveInitialPage(path);
      const { initialScale, initialZoomMode } = resolveInitialZoom(path);
      openFile(path, { initialPage, initialScale, initialZoomMode });
      setActiveView('reader');
    },
    [libraryItems, openFile, resolveInitialPage, resolveInitialZoom, updateItem]
  );

  // 从 LibraryView 拖拽/选择打开文件
  const handleOpenFile = useCallback((file: File | string) => {
    const initialPage = resolveInitialPage(file);
    const { initialScale, initialZoomMode } = resolveInitialZoom(file);
    openFile(file, { initialPage, initialScale, initialZoomMode });
    setActiveView('reader');
  }, [openFile, resolveInitialPage, resolveInitialZoom]);

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
    const targetTab = tabs.find((tab) => tab.id === tabId);
    updateTab(tabId, updates);

    if (targetTab && updates.currentPage !== undefined && Number.isFinite(updates.currentPage) && updates.currentPage >= 1) {
      setLastPage(targetTab.annotationKey, updates.currentPage);
    }

    if (targetTab && updates.scale !== undefined && Number.isFinite(updates.scale) && updates.scale > 0) {
      const nextZoomMode = updates.zoomMode ?? targetTab.zoomMode;
      if (nextZoomMode === 'custom') {
        setLastScale(targetTab.annotationKey, updates.scale);
      }
    }
  }, [setLastPage, setLastScale, tabs, updateTab]);

  const handleChangeDefaultZoomMode = useCallback((mode: DefaultZoomMode) => {
    setDefaultZoomMode(mode);

    if (!activeTab) {
      return;
    }

    if (mode === 'fit_width') {
      handleTabUpdate(activeTab.id, { zoomMode: 'fit_width' });
      return;
    }

    if (mode === 'fixed_100') {
      handleTabUpdate(activeTab.id, { zoomMode: 'custom', scale: 1 });
      return;
    }

    const rememberedScale = getLastScale(activeTab.annotationKey) ?? 1;
    handleTabUpdate(activeTab.id, { zoomMode: 'custom', scale: rememberedScale });
  }, [activeTab, getLastScale, handleTabUpdate, setDefaultZoomMode]);

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
        onChangeDefaultZoomMode={handleChangeDefaultZoomMode}
        onChangeArxivDownloadFolder={setArxivDownloadFolder}
      />
    </div>
  );
}

export default App;
