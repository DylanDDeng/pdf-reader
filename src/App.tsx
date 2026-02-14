import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { LibraryView } from './components/library/LibraryView';
import { Viewer } from './components/viewer/Viewer';

interface RecentFile {
  name: string;
  path: string;
  lastOpened: string;
}

function App() {
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // Load recent files from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentFiles');
    if (stored) {
      try {
        setRecentFiles(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save recent files to localStorage
  const addRecentFile = useCallback((name: string, path: string) => {
    const newFile: RecentFile = {
      name,
      path,
      lastOpened: new Date().toLocaleDateString(),
    };

    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.path !== path);
      const updated = [newFile, ...filtered].slice(0, 20);
      localStorage.setItem('recentFiles', JSON.stringify(updated));
      return updated;
    });
  }, []);

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

  return (
    <div className="flex h-screen bg-[#f6f7f8] dark:bg-background-dark">
      <Sidebar
        onOpenFile={handleOpenFile}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {activeView === 'library' ? (
        <LibraryView
          onOpenFile={handleOpenFile}
          onOpenRecentFile={handleOpenRecentFile}
          recentFiles={recentFiles}
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
