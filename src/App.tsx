import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';
import { useLibrary } from './hooks/useLibrary';
import type { ScannedFile, ImportResult as ImportResultType } from './types/library';

function App() {
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  // Use the library hook for managing PDF library
  const {
    items: libraryItems,
    importProgress,
    importFiles,
    updateItem,
    toggleFavorite,
    removeItem,
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
  const [showImportFromSidebar, setShowImportFromSidebar] = useState(false);

  const handleImportFolder = useCallback(() => {
    setActiveView('library');
    // Trigger import modal in LibraryView
    setShowImportFromSidebar(true);
  }, []);

  // Clear the import trigger after it's been handled
  useEffect(() => {
    if (showImportFromSidebar) {
      const timer = setTimeout(() => setShowImportFromSidebar(false), 100);
      return () => clearTimeout(timer);
    }
  }, [showImportFromSidebar]);

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
      />

      {activeView === 'library' ? (
        <LibraryView
          onOpenRecentFile={handleOpenRecentFile}
          items={libraryItems}
          onImportFiles={handleImportFiles}
          onToggleFavorite={toggleFavorite}
          onRemoveItem={removeItem}
          importProgress={importProgress}
          lastSyncResult={lastSyncResult}
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
