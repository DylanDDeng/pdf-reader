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
  } = useLibrary();

  // Handle opening a file
  const addRecentFile = useCallback(
    (name: string, path: string) => {
      // Update the item's lastOpened timestamp
      const existingItem = libraryItems.find((item) => item.path === path);
      if (existingItem) {
        updateItem(existingItem.id, {
          lastOpened: new Date().toISOString(),
        });
      } else {
        // Import the single file
        const scannedFile: ScannedFile = {
          name,
          path,
          size: 0,
        };
        importFiles([scannedFile]);
      }
    },
    [libraryItems, updateItem, importFiles]
  );

  const handleOpenFile = useCallback(async () => {
    try {
      // Use Tauri's dialog to open file
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: 'PDF',
            extensions: ['pdf'],
          },
        ],
      });

      if (selected) {
        const filePath = selected as string;
        setCurrentFilePath(filePath);
        setCurrentFile(null);
        const fileName = filePath.split('/').pop() || 'document.pdf';
        addRecentFile(fileName, filePath);
        setActiveView('reader');
      }
    } catch (err) {
      console.error('Error opening file dialog:', err);
    }
  }, [addRecentFile]);

  const handleOpenRecentFile = useCallback(
    (path: string) => {
      setCurrentFilePath(path);
      setCurrentFile(null);
      const name = path.split('/').pop() || 'document.pdf';
      addRecentFile(name, path);
      setActiveView('reader');
    },
    [addRecentFile]
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
        onOpenFile={handleOpenFile}
        onImportFolder={handleImportFolder}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {activeView === 'library' ? (
        <LibraryView
          onOpenFile={handleOpenFile}
          onOpenRecentFile={handleOpenRecentFile}
          items={libraryItems}
          onImportFiles={handleImportFiles}
          onToggleFavorite={toggleFavorite}
          importProgress={importProgress}
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
