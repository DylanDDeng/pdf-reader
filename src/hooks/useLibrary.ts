/**
 * useLibrary Hook - Manages PDF library state and import operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  LibraryItem,
  LibraryState,
  WatchedFolder,
  ScanResult,
  ImportResult,
  ImportProgress,
  FolderChangedEvent,
  ScannedFile,
} from '../types/library';
import type { ArxivImportOutcome } from '../types/arxiv';
import * as libraryService from '../services/libraryService';

export interface UseLibraryReturn {
  // State
  items: LibraryItem[];
  watchedFolders: WatchedFolder[];
  isLoading: boolean;
  importProgress: ImportProgress | null;
  isSyncing: boolean;
  lastSyncResult: { removedCount: number } | null;

  // Actions
  scanDirectory: (path: string, recursive?: boolean) => Promise<ScanResult>;
  importFiles: (files: ScannedFile[]) => Promise<ImportResult>;
  importFromArxiv: (
    linkOrId: string,
    downloadFolder: string | null
  ) => Promise<ArxivImportOutcome>;
  addWatchedFolder: (path: string, recursive?: boolean) => Promise<void>;
  removeWatchedFolder: (watchId: string) => Promise<void>;
  toggleWatchedFolder: (watchId: string) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<LibraryItem>) => void;
  toggleFavorite: (itemId: string) => void;
  renameItem: (itemId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  refreshLibrary: () => void;
  syncLibrary: () => Promise<{ removedCount: number }>;
}

export function useLibrary(): UseLibraryReturn {
  const [state, setState] = useState<LibraryState>({
    items: [],
    watchedFolders: [],
    lastUpdated: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ removedCount: number } | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const syncCompletedRef = useRef(false);

  // Sync library - verify files exist and remove invalid entries
  const syncLibrary = useCallback(async (): Promise<{ removedCount: number }> => {
    setIsSyncing(true);
    try {
      const { validItems, removedCount } = await libraryService.verifyAndCleanLibrary(
        state.items
      );

      if (removedCount > 0) {
        const newState = { ...state, items: validItems };
        libraryService.saveLibrary(newState);
        setState(newState);
        setLastSyncResult({ removedCount });
      }

      return { removedCount };
    } catch (error) {
      console.error('Error syncing library:', error);
      return { removedCount: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [state]);

  // Load library on mount
  useEffect(() => {
    // Migrate old recentFiles if needed
    const migratedItems = libraryService.migrateRecentFiles();
    if (migratedItems) {
      const newState: LibraryState = {
        items: migratedItems,
        watchedFolders: [],
        lastUpdated: new Date().toISOString(),
      };
      libraryService.saveLibrary(newState);
      setState(newState);
    } else {
      const savedState = libraryService.getLibrary();
      setState(savedState);
    }

    // Setup folder change listener
    const setupListener = async () => {
      unlistenRef.current = await libraryService.onFolderChanged(
        handleFolderChanged
      );
    };

    setupListener();

    // Cleanup
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  // Auto-sync library on initial load
  useEffect(() => {
    if (!syncCompletedRef.current && state.items.length > 0) {
      syncCompletedRef.current = true;

      const autoSync = async () => {
        const { validItems, removedCount } = await libraryService.verifyAndCleanLibrary(
          state.items
        );

        if (removedCount > 0) {
          const newState = { ...state, items: validItems };
          libraryService.saveLibrary(newState);
          setState(newState);
          setLastSyncResult({ removedCount });

          // Clear sync result after 5 seconds
          setTimeout(() => setLastSyncResult(null), 5000);
        }
      };

      autoSync();
    }
  }, [state.items.length]);

  // Handle folder change events
  const handleFolderChanged = useCallback(
    async (event: FolderChangedEvent) => {
      if (event.eventType === 'created') {
        // Auto-import new PDF file
        try {
          const scannedFile: ScannedFile = {
            name: event.filePath.split('/').pop() || 'Unknown',
            path: event.filePath,
            size: 0,
          };

          const result = await libraryService.importFiles(
            state.items,
            [scannedFile],
            'watched'
          );

          if (result.importedItems.length > 0) {
            const newItems = [...result.importedItems, ...state.items];
            const newState = { ...state, items: newItems };
            libraryService.saveLibrary(newState);
            setState(newState);
          }
        } catch (error) {
          console.error('Error auto-importing file:', error);
        }
      }
    },
    [state]
  );

  // Scan directory
  const scanDirectory = useCallback(
    async (path: string, recursive: boolean = true): Promise<ScanResult> => {
      setIsLoading(true);
      setImportProgress({
        current: 0,
        total: 0,
        currentFile: '',
        status: 'scanning',
      });

      try {
        const result = await libraryService.scanDirectory(path, recursive);
        return result;
      } finally {
        setIsLoading(false);
        setImportProgress(null);
      }
    },
    []
  );

  // Import files
  const importFiles = useCallback(
    async (files: ScannedFile[]): Promise<ImportResult> => {
      setIsLoading(true);
      setImportProgress({
        current: 0,
        total: files.length,
        currentFile: '',
        status: 'importing',
      });

      try {
        const result = await libraryService.importFiles(
          state.items,
          files,
          'imported',
          (current, total, fileName) => {
            setImportProgress({
              current,
              total,
              currentFile: fileName,
              status: 'importing',
            });
          }
        );

        // Update state with new items
        if (result.importedItems.length > 0) {
          const newItems = [...result.importedItems, ...state.items];
          const newState = { ...state, items: newItems };
          libraryService.saveLibrary(newState);
          setState(newState);
        }

        return result;
      } finally {
        setIsLoading(false);
        setImportProgress({
          current: files.length,
          total: files.length,
          currentFile: '',
          status: 'completed',
        });

        // Clear progress after a delay
        setTimeout(() => setImportProgress(null), 2000);
      }
    },
    [state]
  );

  // Add watched folder
  const addWatchedFolder = useCallback(
    async (path: string, recursive: boolean = true): Promise<void> => {
      try {
        const watchId = await libraryService.startWatchFolder(path, recursive);

        const newFolder: WatchedFolder = {
          id: watchId,
          path,
          recursive,
          enabled: true,
          addedAt: new Date().toISOString(),
        };

        const newWatchedFolders = [...state.watchedFolders, newFolder];
        const newState = { ...state, watchedFolders: newWatchedFolders };
        libraryService.saveLibrary(newState);
        setState(newState);
      } catch (error) {
        console.error('Error adding watched folder:', error);
        throw error;
      }
    },
    [state]
  );

  // Remove watched folder
  const removeWatchedFolder = useCallback(
    async (watchId: string): Promise<void> => {
      try {
        await libraryService.stopWatchFolder(watchId);

        const newWatchedFolders = state.watchedFolders.filter(
          (f) => f.id !== watchId
        );
        const newState = { ...state, watchedFolders: newWatchedFolders };
        libraryService.saveLibrary(newState);
        setState(newState);
      } catch (error) {
        console.error('Error removing watched folder:', error);
        throw error;
      }
    },
    [state]
  );

  // Toggle watched folder enabled state
  const toggleWatchedFolder = useCallback(
    (watchId: string) => {
      const newWatchedFolders = state.watchedFolders.map((f) =>
        f.id === watchId ? { ...f, enabled: !f.enabled } : f
      );
      const newState = { ...state, watchedFolders: newWatchedFolders };
      libraryService.saveLibrary(newState);
      setState(newState);
    },
    [state]
  );

  // Remove item
  const removeItem = useCallback(
    (itemId: string) => {
      const newItems = libraryService.removeFromLibrary(state.items, itemId);
      const newState = { ...state, items: newItems };
      libraryService.saveLibrary(newState);
      setState(newState);
    },
    [state]
  );

  // Update item
  const updateItem = useCallback(
    (itemId: string, updates: Partial<LibraryItem>) => {
      const newItems = libraryService.updateLibraryItem(
        state.items,
        itemId,
        updates
      );
      const newState = { ...state, items: newItems };
      libraryService.saveLibrary(newState);
      setState(newState);
    },
    [state]
  );

  // Toggle favorite
  const toggleFavorite = useCallback(
    (itemId: string) => {
      const item = state.items.find((i) => i.id === itemId);
      if (item) {
        const newItems = libraryService.updateLibraryItem(
          state.items,
          itemId,
          { favorite: !item.favorite }
        );
        const newState = { ...state, items: newItems };
        libraryService.saveLibrary(newState);
        setState(newState);
      }
    },
    [state]
  );

  // Rename item (file and library entry)
  const renameItem = useCallback(
    async (itemId: string, newName: string): Promise<{ success: boolean; error?: string }> => {
      const item = state.items.find((i) => i.id === itemId);
      if (!item) {
        return { success: false, error: 'Item not found' };
      }

      try {
        const result = await libraryService.renamePdfFile(item.path, newName);

        if (result.success && result.newPath) {
          // Update both name and path in the library
          const newItems = libraryService.updateLibraryItem(
            state.items,
            itemId,
            {
              name: newName,
              path: result.newPath
            }
          );
          const newState = { ...state, items: newItems };
          libraryService.saveLibrary(newState);
          setState(newState);
          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (error) {
        console.error('Error renaming item:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [state]
  );

  // Refresh library
  const refreshLibrary = useCallback(() => {
    const savedState = libraryService.getLibrary();
    setState(savedState);
  }, []);

  const importFromArxiv = useCallback(async (
    linkOrId: string,
    downloadFolder: string | null
  ): Promise<ArxivImportOutcome> => {
    const normalizedLink = linkOrId.trim();
    if (!normalizedLink) {
      return {
        status: 'error',
        message: 'Please enter an arXiv URL or ID.',
      };
    }

    if (!downloadFolder) {
      return {
        status: 'error',
        message: 'Please set the default arXiv download folder in Settings first.',
      };
    }

    setIsLoading(true);
    setImportProgress({
      current: 0,
      total: 1,
      currentFile: normalizedLink,
      status: 'importing',
    });

    try {
      const arxivResult = await libraryService.importArxivPaper({
        input_url_or_id: normalizedLink,
        target_dir: downloadFolder,
        conflict_policy: 'skip',
      });

      if (arxivResult.status === 'skipped') {
        const reason = arxivResult.reason ?? 'unknown';
        const messageByReason: Record<string, string> = {
          file_exists: 'This paper already exists in your download folder. Skipped.',
          invalid_link: 'Invalid arXiv URL or ID.',
          paper_not_found: 'Paper not found on arXiv.',
          write_failed: 'Cannot write files to the selected folder.',
          network_error: 'Network error while downloading from arXiv.',
          invalid_conflict_policy: 'Unsupported conflict policy.',
        };

        return {
          status: reason === 'file_exists' ? 'skipped' : 'error',
          message: messageByReason[reason] ?? `Import failed (${reason}).`,
          paperTitle: arxivResult.paper?.title,
          pdfPath: arxivResult.pdf_path,
        };
      }

      const scannedFile = libraryService.createScannedFileFromArxivResult(arxivResult);
      if (!scannedFile) {
        return {
          status: 'error',
          message: 'Downloaded paper metadata is incomplete.',
        };
      }

      const importResult = await libraryService.importFiles(
        state.items,
        [scannedFile],
        'arxiv'
      );

      if (importResult.importedItems.length > 0) {
        const newItems = [...importResult.importedItems, ...state.items];
        const newState = { ...state, items: newItems };
        libraryService.saveLibrary(newState);
        setState(newState);
      }

      return {
        status: 'downloaded',
        message: 'arXiv paper downloaded and imported successfully.',
        paperTitle: arxivResult.paper?.title,
        pdfPath: arxivResult.pdf_path,
      };
    } catch (error) {
      console.error('Error importing arXiv paper:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to import from arXiv.',
      };
    } finally {
      setIsLoading(false);
      setImportProgress({
        current: 1,
        total: 1,
        currentFile: '',
        status: 'completed',
      });
      setTimeout(() => setImportProgress(null), 1200);
    }
  }, [state]);

  return {
    items: state.items,
    watchedFolders: state.watchedFolders,
    isLoading,
    importProgress,
    isSyncing,
    lastSyncResult,
    scanDirectory,
    importFiles,
    importFromArxiv,
    addWatchedFolder,
    removeWatchedFolder,
    toggleWatchedFolder,
    removeItem,
    updateItem,
    toggleFavorite,
    renameItem,
    refreshLibrary,
    syncLibrary,
  };
}
