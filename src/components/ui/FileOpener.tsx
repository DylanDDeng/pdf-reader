import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileOpenerProps {
  onFileOpen: (file: File) => void;
}

export function FileOpener({ onFileOpen }: FileOpenerProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileOpen(acceptedFiles[0]);
      }
    },
    [onFileOpen]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        {isDragActive ? (
          <p className="text-primary font-medium">Drop the PDF file here...</p>
        ) : (
          <>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              Drag and drop a PDF file here, or click to select
            </p>
            <p className="text-sm text-slate-400">Only PDF files are supported</p>
          </>
        )}
      </div>
    </div>
  );
}
