import { useState, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';
import { useLibrary } from './hooks/useLibrary';
import type { ScannedFile, ImportResult as ImportResultType } from './types/library';

function App() {
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  // Handle opening a file from the library - just open it for reading, don't add to library
  const handleOpenRecentFile = useCallback(
    (path: string) => {
      setCurrentFilePath(path);
      setCurrentFile(null);
      // Update the item's lastOpened timestamp if it exists in the library
      const existingItem = libraryItems.find((item) => item.path === path);
      if (existingItem) {
        updateItem(existingItem.id, {
          lastOpened: new Date().toISOString(),
        });
      }
      setActiveView('reader');
    },
    [libraryItems, updateItem]
  );

  const handleCloseViewer = useCallback(() => {
    setCurrentFile(null);
    setCurrentFilePath(null);
    setActiveView('library');
  }, []);

  // Handle import folder from sidebar
  const [importTrigger, setImportTrigger] = useState(0);

  const handleImportFolder = useCallback(() => {
    setActiveView('library');
    // Trigger import modal in LibraryView
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
          file={currentFile}
          filePath={currentFilePath}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}

export default App;
