/**
 * Library types for PDF batch import functionality
 */

export interface PdfMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  path: string;
  size?: number;
  lastOpened: string;
  addedAt: string;
  source: 'manual' | 'imported' | 'watched';
  metadata?: PdfMetadata;
  favorite?: boolean;
  tags?: string[];
}

export interface WatchedFolder {
  id: string;
  path: string;
  recursive: boolean;
  enabled: boolean;
  addedAt: string;
}

export interface ScanResult {
  files: ScannedFile[];
  totalCount: number;
  errorCount: number;
  errors: string[];
}

export interface ScannedFile {
  name: string;
  path: string;
  size: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
  status: 'scanning' | 'importing' | 'completed' | 'error';
}

export interface ImportResult {
  success: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  importedItems: LibraryItem[];
}

export interface ImportError {
  filePath: string;
  error: string;
}

export interface FolderChangedEvent {
  watchId: string;
  folderPath: string;
  eventType: 'created' | 'removed' | 'modified';
  filePath: string;
}

export interface LibraryState {
  items: LibraryItem[];
  watchedFolders: WatchedFolder[];
  lastUpdated: string;
}

// Default library state
export const DEFAULT_LIBRARY_STATE: LibraryState = {
  items: [],
  watchedFolders: [],
  lastUpdated: new Date().toISOString(),
};
