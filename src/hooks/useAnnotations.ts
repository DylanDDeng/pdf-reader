import { useState, useCallback, useEffect } from 'react';
import type { Annotation, HighlightColor } from '../types/annotation';

const STORAGE_KEY = 'pdf-reader-annotations';

export function useAnnotations(fileId: string | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load annotations from localStorage
  useEffect(() => {
    if (!fileId) {
      setAnnotations([]);
      setIsLoaded(true);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allAnnotations = JSON.parse(stored);
        setAnnotations(allAnnotations[fileId] || []);
      }
    } catch (err) {
      console.error('Failed to load annotations:', err);
    }
    setIsLoaded(true);
  }, [fileId]);

  // Save annotations to localStorage
  const saveAnnotations = useCallback((newAnnotations: Annotation[]) => {
    if (!fileId) return;

    setAnnotations(newAnnotations);
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allAnnotations = stored ? JSON.parse(stored) : {};
      allAnnotations[fileId] = newAnnotations;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allAnnotations));
    } catch (err) {
      console.error('Failed to save annotations:', err);
    }
  }, [fileId]);

  // Add a new highlight annotation
  const addHighlight = useCallback((
    page: number,
    selectedText: string,
    color: HighlightColor,
    rects: Array<{ left: number; top: number; width: number; height: number }>
  ): Annotation => {
    const newAnnotation: Annotation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'highlight',
      page,
      selectedText,
      color,
      rects,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveAnnotations([...annotations, newAnnotation]);
    return newAnnotation;
  }, [annotations, saveAnnotations]);

  // Update annotation comment
  const updateComment = useCallback((annotationId: string, comment: string) => {
    const updated = annotations.map(ann => 
      ann.id === annotationId 
        ? { ...ann, comment, updatedAt: new Date().toISOString() }
        : ann
    );
    saveAnnotations(updated);
  }, [annotations, saveAnnotations]);

  // Change highlight color
  const updateColor = useCallback((annotationId: string, color: HighlightColor) => {
    const updated = annotations.map(ann => 
      ann.id === annotationId 
        ? { ...ann, color, updatedAt: new Date().toISOString() }
        : ann
    );
    saveAnnotations(updated);
  }, [annotations, saveAnnotations]);

  // Delete annotation
  const deleteAnnotation = useCallback((annotationId: string) => {
    const updated = annotations.filter(ann => ann.id !== annotationId);
    saveAnnotations(updated);
  }, [annotations, saveAnnotations]);

  // Get annotations for specific page
  const getAnnotationsByPage = useCallback((page: number) => {
    return annotations.filter(ann => ann.page === page);
  }, [annotations]);

  // Get all annotations sorted by time
  const getAllAnnotations = useCallback(() => {
    return [...annotations].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [annotations]);

  return {
    annotations,
    isLoaded,
    addHighlight,
    updateComment,
    updateColor,
    deleteAnnotation,
    getAnnotationsByPage,
    getAllAnnotations,
  };
}
