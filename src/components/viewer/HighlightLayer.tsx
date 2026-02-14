import { useMemo } from 'react';
import type { Annotation } from '../../types/annotation';
import { HIGHLIGHT_COLORS } from '../../types/annotation';

interface HighlightLayerProps {
  annotations: Annotation[];
  page: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  onAnnotationClick?: (annotation: Annotation) => void;
}

export function HighlightLayer({
  annotations,
  page,
  scale,
  pageWidth,
  pageHeight,
  onAnnotationClick,
}: HighlightLayerProps) {
  const pageAnnotations = useMemo(() => {
    return annotations.filter(ann => ann.page === page);
  }, [annotations, page]);

  if (pageAnnotations.length === 0) {
    return null;
  }

  return (
    <div 
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {pageAnnotations.map((annotation) => (
        <div key={annotation.id} className="pointer-events-auto">
          {annotation.rects.map((rect, index) => {
            const color = HIGHLIGHT_COLORS[annotation.color];
            return (
              <div
                key={`${annotation.id}-${index}`}
                className="absolute cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  left: rect.left * scale,
                  top: rect.top * scale,
                  width: rect.width * scale,
                  height: rect.height * scale,
                  backgroundColor: color.bg,
                  borderRadius: '2px',
                  mixBlendMode: 'multiply',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationClick?.(annotation);
                }}
                title={annotation.comment || annotation.selectedText}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
