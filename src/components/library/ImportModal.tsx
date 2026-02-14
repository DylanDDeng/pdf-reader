/**
 * ImportModal - Modal for selecting folder and import options
 */

import { useState, useCallback } from 'react';
import { X, FolderOpen, RefreshCw, ChevronRight, FileText, Eye, EyeOff } from 'lucide-react';
import type { ScanResult, ScannedFile } from '../../types/library';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: ScannedFile[]) => void;
  isImporting: boolean;
}

export function ImportModal({
  isOpen,
  onClose,
  onImport,
  isImporting,
}: ImportModalProps) {
  const [folderPath, setFolderPath] = useState<string>('');
  const [recursive, setRecursive] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleSelectFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select folder to import PDFs from',
      });

      if (selected && typeof selected === 'string') {
        setFolderPath(selected);
        setScanResult(null);
        setSelectedFiles(new Set());
        setError(null);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
      setError('Failed to select folder');
    }
  }, []);

  const handleScan = useCallback(async () => {
    if (!folderPath) return;

    setError(null);
    setScanResult(null);
    setIsScanning(true);

    try {
      const { scanDirectory } = await import('../../services/libraryService');
      const result = await scanDirectory(folderPath, recursive);
      setScanResult(result);
      // Select all files by default
      setSelectedFiles(new Set(result.files.map((f) => f.path)));
    } catch (err) {
      console.error('Error scanning directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan directory');
    } finally {
      setIsScanning(false);
    }
  }, [folderPath, recursive]);

  const handleToggleFile = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (scanResult) {
      setSelectedFiles(new Set(scanResult.files.map((f) => f.path)));
    }
  }, [scanResult]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const handleImport = useCallback(() => {
    if (!scanResult) return;

    const filesToImport = scanResult.files.filter((f) =>
      selectedFiles.has(f.path)
    );

    onImport(filesToImport);
    handleClose();
  }, [scanResult, selectedFiles, onImport]);

  const handleClose = useCallback(() => {
    setFolderPath('');
    setScanResult(null);
    setSelectedFiles(new Set());
    setError(null);
    onClose();
  }, [onClose]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Import PDF Files
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Folder Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Folder
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="Select a folder to scan for PDFs..."
                  className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
                  readOnly
                />
              </div>
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Scan subdirectories recursively
            </label>
          </div>

          {/* Scan Button */}
          <div className="mb-4">
            <button
              onClick={handleScan}
              disabled={!folderPath || isScanning}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`}
              />
              {isScanning ? 'Scanning...' : 'Scan for PDFs'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Scan Results */}
          {scanResult && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Found {scanResult.totalCount} PDF file
                    {scanResult.totalCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({selectedFiles.size} selected)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Show
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs text-primary hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {showPreview && scanResult.files.length > 0 && (
                <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  {scanResult.files.map((file) => (
                    <div
                      key={file.path}
                      className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer ${
                        !selectedFiles.has(file.path) ? 'opacity-50' : ''
                      }`}
                      onClick={() => handleToggleFile(file.path)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => handleToggleFile(file.path)}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-800 dark:text-white truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatSize(file.size)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  ))}
                </div>
              )}

              {scanResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {scanResult.errorCount} file(s) could not be read
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!scanResult || selectedFiles.size === 0 || isImporting}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting
              ? 'Importing...'
              : `Import ${selectedFiles.size} File${selectedFiles.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
