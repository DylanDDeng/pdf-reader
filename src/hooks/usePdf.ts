import { useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument } from '../utils/pdf';

interface PdfState {
  document: PDFDocumentProxy | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  loading: boolean;
  error: string | null;
  fileName: string | null;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4.0;
const SCALE_STEP = 0.25;

export function usePdf() {
  const [state, setState] = useState<PdfState>({
    document: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    loading: false,
    error: null,
    fileName: null,
  });

  const loadPdf = useCallback(async (source: string | File, name?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const fileName = name || (source instanceof File ? source.name : source.split('/').pop() || 'document.pdf');

      let docSource: string | ArrayBuffer;
      if (typeof source === 'string') {
        docSource = source;
      } else {
        docSource = await source.arrayBuffer();
      }

      const doc = await loadPdfDocument(docSource);

      setState({
        document: doc,
        currentPage: 1,
        totalPages: doc.numPages,
        scale: 1.0,
        loading: false,
        error: null,
        fileName,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load PDF',
      }));
    }
  }, []);

  const closePdf = useCallback(() => {
    setState({
      document: null,
      currentPage: 1,
      totalPages: 0,
      scale: 1.0,
      loading: false,
      error: null,
      fileName: null,
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setState((prev) => {
      const newPage = Math.max(1, Math.min(page, prev.totalPages));
      return { ...prev, currentPage: newPage };
    });
  }, []);

  const nextPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + SCALE_STEP, MAX_SCALE),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - SCALE_STEP, MIN_SCALE),
    }));
  }, []);

  const setScale = useCallback((scale: number) => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(MIN_SCALE, Math.min(scale, MAX_SCALE)),
    }));
  }, []);

  const fitWidth = useCallback((containerWidth: number, pageWidth: number) => {
    if (pageWidth > 0) {
      const newScale = (containerWidth - 80) / pageWidth;
      setState((prev) => ({
        ...prev,
        scale: Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE)),
      }));
    }
  }, []);

  return {
    ...state,
    loadPdf,
    closePdf,
    goToPage,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    setScale,
    fitWidth,
  };
}
