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
import * as libraryService from '../services/libraryService';

export interface UseLibraryReturn {
  // State
  items: LibraryItem[];
  watchedFolders: WatchedFolder[];
  isLoading: boolean;
  importProgress: ImportProgress | null;

  // Actions
  scanDirectory: (path: string, recursive?: boolean) => Promise<ScanResult>;
  importFiles: (files: ScannedFile[]) => Promise<ImportResult>;
  addWatchedFolder: (path: string, recursive?: boolean) => Promise<void>;
  removeWatchedFolder: (watchId: string) => Promise<void>;
  toggleWatchedFolder: (watchId: string) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<LibraryItem>) => void;
  toggleFavorite: (itemId: string) => void;
  refreshLibrary: () => void;
}

export function useLibrary(): UseLibraryReturn {
  const [state, setState] = useState<LibraryState>({
    items: [],
    watchedFolders: [],
    lastUpdated: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

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

  // Refresh library
  const refreshLibrary = useCallback(() => {
    const savedState = libraryService.getLibrary();
    setState(savedState);
  }, []);

  return {
    items: state.items,
    watchedFolders: state.watchedFolders,
    isLoading,
    importProgress,
    scanDirectory,
    importFiles,
    addWatchedFolder,
    removeWatchedFolder,
    toggleWatchedFolder,
    removeItem,
    updateItem,
    toggleFavorite,
    refreshLibrary,
  };
}
