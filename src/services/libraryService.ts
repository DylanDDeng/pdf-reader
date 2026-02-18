/**
 * Library Service - Handles PDF library management, scanning, and import
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as pdfjsLib from 'pdfjs-dist';
import type {
  LibraryItem,
  LibraryState,
  ScanResult,
  ScannedFile,
  ImportResult,
  FolderChangedEvent,
} from '../types/library';
import type { ArxivImportRequest, ArxivImportResult } from '../types/arxiv';

const LIBRARY_STORAGE_KEY = 'pdfLibrary';
const RECENT_FILES_KEY = 'recentFiles';

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Scan directory for PDF files
export async function scanDirectory(
  dirPath: string,
  recursive: boolean = true,
  maxDepth: number = 10
): Promise<ScanResult> {
  try {
    const result = await invoke<ScanResult>('scan_directory_for_pdfs', {
      dirPath,
      recursive,
      maxDepth,
    });
    return result;
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
}

// Extract PDF metadata using pdfjs
export async function extractMetadata(
  filePath: string
): Promise<{ title?: string; author?: string; pageCount?: number; thumbnail?: string }> {
  try {
    // Read file using Tauri's fs plugin
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const fileData = await readFile(filePath);
    const arrayBuffer = fileData.buffer;

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const metadata = await pdf.getMetadata();
    const info = metadata.info as Record<string, unknown> | undefined;

    const result: { title?: string; author?: string; pageCount?: number; thumbnail?: string } = {
      title: (info?.Title as string) || undefined,
      author: (info?.Author as string) || undefined,
      pageCount: pdf.numPages,
    };

    // Generate first page thumbnail
    try {
      const page = await pdf.getPage(1);
      const canvas = document.createElement('canvas');

      // Use smaller scale for thumbnail
      const scale = 0.3;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (context) {
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        // Convert to base64 data URL (JPEG format to reduce size)
        result.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      }
    } catch (e) {
      console.warn('Failed to generate thumbnail:', e);
    }

    return result;
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return { pageCount: undefined };
  }
}

// Create a library item from a scanned file
export async function createLibraryItem(
  file: ScannedFile,
  source: 'manual' | 'imported' | 'watched' | 'arxiv' = 'imported'
): Promise<LibraryItem> {
  const metadata = await extractMetadata(file.path);

  return {
    id: generateId(),
    name: metadata.title || file.name,
    path: file.path,
    size: file.size,
    lastOpened: new Date().toISOString(),
    addedAt: new Date().toISOString(),
    source,
    metadata,
    favorite: false,
    tags: [],
  };
}

// Get library state from localStorage
export function getLibrary(): LibraryState {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        items: parsed.items || [],
        watchedFolders: parsed.watchedFolders || [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('Error loading library:', error);
  }

  return {
    items: [],
    watchedFolders: [],
    lastUpdated: new Date().toISOString(),
  };
}

// Save library state to localStorage
export function saveLibrary(state: LibraryState): void {
  try {
    const updated = {
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving library:', error);
  }
}

// Add items to library
export function addToLibrary(
  currentItems: LibraryItem[],
  newItems: LibraryItem[]
): { items: LibraryItem[]; added: number; skipped: number } {
  const existingPaths = new Set(currentItems.map((item) => item.path));
  const itemsToAdd: LibraryItem[] = [];
  let skipped = 0;

  for (const item of newItems) {
    if (!existingPaths.has(item.path)) {
      itemsToAdd.push(item);
      existingPaths.add(item.path);
    } else {
      skipped++;
    }
  }

  return {
    items: [...itemsToAdd, ...currentItems],
    added: itemsToAdd.length,
    skipped,
  };
}

// Remove item from library
export function removeFromLibrary(
  items: LibraryItem[],
  itemId: string
): LibraryItem[] {
  return items.filter((item) => item.id !== itemId);
}

// Update item in library
export function updateLibraryItem(
  items: LibraryItem[],
  itemId: string,
  updates: Partial<LibraryItem>
): LibraryItem[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...updates } : item
  );
}

// Import scanned files into library
export async function importFiles(
  currentItems: LibraryItem[],
  files: ScannedFile[],
  source: 'manual' | 'imported' | 'watched' | 'arxiv' = 'imported',
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    importedItems: [],
  };

  const existingPaths = new Set(currentItems.map((item) => item.path));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    // Skip duplicates
    if (existingPaths.has(file.path)) {
      result.skipped++;
      continue;
    }

    try {
      const item = await createLibraryItem(file, source);
      result.importedItems.push(item);
      result.success++;
      existingPaths.add(file.path);
    } catch (error) {
      result.failed++;
      result.errors.push({
        filePath: file.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

// Start watching a folder
export async function startWatchFolder(
  folderPath: string,
  recursive: boolean = true
): Promise<string> {
  try {
    const watchId = await invoke<string>('start_watch_folder', {
      folderPath,
      recursive,
    });
    return watchId;
  } catch (error) {
    console.error('Error starting watch folder:', error);
    throw error;
  }
}

// Stop watching a folder
export async function stopWatchFolder(watchId: string): Promise<void> {
  try {
    await invoke('stop_watch_folder', { watchId });
  } catch (error) {
    console.error('Error stopping watch folder:', error);
    throw error;
  }
}

// Listen for folder change events
export async function onFolderChanged(
  callback: (event: FolderChangedEvent) => void
): Promise<() => void> {
  const unlisten = await listen<FolderChangedEvent>('folder-changed', (event) => {
    callback(event.payload);
  });

  return unlisten;
}

// Migrate old recentFiles to new library format
export function migrateRecentFiles(): LibraryItem[] | null {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (stored) {
      const recentFiles = JSON.parse(stored);
      if (Array.isArray(recentFiles) && recentFiles.length > 0) {
        // Check if library already exists
        const library = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (!library) {
          // Migrate recent files to library format
          const migratedItems: LibraryItem[] = recentFiles.map(
            (file: { name: string; path: string; lastOpened: string }) => ({
              id: generateId(),
              name: file.name,
              path: file.path,
              lastOpened: file.lastOpened,
              addedAt: file.lastOpened,
              source: 'manual' as const,
              favorite: false,
              tags: [],
            })
          );
          return migratedItems;
        }
      }
    }
  } catch (error) {
    console.error('Error migrating recent files:', error);
  }

  return null;
}

// Search library items
export function searchLibrary(
  items: LibraryItem[],
  query: string
): LibraryItem[] {
  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.path.toLowerCase().includes(lowerQuery) ||
      item.metadata?.author?.toLowerCase().includes(lowerQuery) ||
      item.metadata?.title?.toLowerCase().includes(lowerQuery)
  );
}

// Sort library items
export type SortField = 'name' | 'addedAt' | 'lastOpened' | 'size' | 'pageCount';
export type SortOrder = 'asc' | 'desc';

export function sortLibrary(
  items: LibraryItem[],
  field: SortField,
  order: SortOrder
): LibraryItem[] {
  const sorted = [...items].sort((a, b) => {
    let valueA: string | number | undefined;
    let valueB: string | number | undefined;

    switch (field) {
      case 'name':
        valueA = a.name.toLowerCase();
        valueB = b.name.toLowerCase();
        break;
      case 'addedAt':
        valueA = new Date(a.addedAt).getTime();
        valueB = new Date(b.addedAt).getTime();
        break;
      case 'lastOpened':
        valueA = new Date(a.lastOpened).getTime();
        valueB = new Date(b.lastOpened).getTime();
        break;
      case 'size':
        valueA = a.size || 0;
        valueB = b.size || 0;
        break;
      case 'pageCount':
        valueA = a.metadata?.pageCount || 0;
        valueB = b.metadata?.pageCount || 0;
        break;
    }

    if (valueA === undefined) valueA = 0;
    if (valueB === undefined) valueB = 0;

    if (valueA < valueB) return order === 'asc' ? -1 : 1;
    if (valueA > valueB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

// Verify which files exist on disk and return valid items
export async function verifyAndCleanLibrary(
  items: LibraryItem[]
): Promise<{ validItems: LibraryItem[]; removedCount: number }> {
  if (items.length === 0) {
    return { validItems: [], removedCount: 0 };
  }

  const paths = items.map((item) => item.path);

  try {
    const results = await invoke<[string, boolean][]>('verify_files_exist', {
      filePaths: paths,
    });

    const validPaths = new Set(
      results.filter(([_, exists]) => exists).map(([path]) => path)
    );

    const validItems = items.filter((item) => validPaths.has(item.path));
    const removedCount = items.length - validItems.length;

    return { validItems, removedCount };
  } catch (error) {
    console.error('Error verifying files:', error);
    // On error, return all items unchanged
    return { validItems: items, removedCount: 0 };
  }
}

// Rename a PDF file in the filesystem
export async function renamePdfFile(
  oldPath: string,
  newName: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    // Remove .pdf extension from newName if present (we'll preserve the original extension)
    const cleanName = newName.replace(/\.pdf$/i, '');

    const newPath = await invoke<string>('rename_file', {
      oldPath,
      newName: cleanName,
    });

    return { success: true, newPath };
  } catch (error) {
    console.error('Error renaming file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function getFileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'Unknown.pdf';
}

export async function importArxivPaper(
  request: ArxivImportRequest
): Promise<ArxivImportResult> {
  try {
    return await invoke<ArxivImportResult>('import_arxiv_paper', {
      inputUrlOrId: request.input_url_or_id,
      targetDir: request.target_dir,
      conflictPolicy: request.conflict_policy,
    });
  } catch (error) {
    console.error('Error importing arXiv paper:', error);
    return {
      status: 'skipped',
      reason: 'network_error',
    };
  }
}

export function createScannedFileFromArxivResult(
  result: ArxivImportResult
): ScannedFile | null {
  if (result.status !== 'downloaded' || !result.pdf_path || !result.pdf_size) {
    return null;
  }

  return {
    name: getFileNameFromPath(result.pdf_path),
    path: result.pdf_path,
    size: result.pdf_size,
  };
}
