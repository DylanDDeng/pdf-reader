import * as pdfjsLib from 'pdfjs-dist';
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';

// Set the worker source - uses the file copied to public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export { pdfjsLib };

export interface OutlineItem {
  title: string;
  page: number;
  level: number;
}

export async function loadPdfDocument(source: string | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument(source);
  return await loadingTask.promise;
}

export async function extractOutline(doc: pdfjsLib.PDFDocumentProxy): Promise<OutlineItem[]> {
  try {
    const outline = await doc.getOutline();
    if (!outline || outline.length === 0) {
      return [];
    }

    const result: OutlineItem[] = [];

    const processOutlineItem = async (items: any[], level: number = 0) => {
      for (const item of items) {
        // Get the page number from the destination
        let pageNumber = 1;
        if (item.dest) {
          try {
            const dest = await doc.getDestination(item.dest);
            if (dest) {
              const pageRef = Array.isArray(dest) ? dest[0] : dest;
              const pageIndex = await doc.getPageIndex(pageRef);
              pageNumber = pageIndex + 1; // Page numbers are 1-based
            }
          } catch (e) {
            console.warn('Failed to resolve destination:', item.dest, e);
          }
        }

        result.push({
          title: item.title || 'Untitled',
          page: pageNumber,
          level,
        });

        // Process children recursively
        if (item.items && item.items.length > 0) {
          await processOutlineItem(item.items, level + 1);
        }
      }
    };

    await processOutlineItem(outline);
    return result;
  } catch (err) {
    console.error('Error extracting outline:', err);
    return [];
  }
}

export async function renderPage(
  page: pdfjsLib.PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): Promise<void> {
  const task = startRenderPage(page, canvas, scale);
  await task.promise;
}

export interface PdfCanvasRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export function startRenderPage(
  page: pdfjsLib.PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): PdfCanvasRenderTask {
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  const scaledWidth = Math.floor(viewport.width * outputScale);
  const scaledHeight = Math.floor(viewport.height * outputScale);
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const renderContext = {
    canvas: canvas,
    viewport: viewport,
    transform,
  };

  const renderTask = page.render(renderContext);
  return {
    promise: renderTask.promise,
    cancel: () => {
      try {
        renderTask.cancel();
      } catch {
        // Ignore cancellation errors from already-completed tasks.
      }
    },
  };
}

export interface PdfTextLayerTask {
  cancel: () => void;
  destroy: () => void;
  element: HTMLDivElement;
}

export async function renderTextLayer(
  page: pdfjsLib.PDFPageProxy,
  container: HTMLDivElement,
  scale: number = 1.0,
  previousLayer?: PdfTextLayerTask | null
): Promise<PdfTextLayerTask> {
  previousLayer?.destroy();

  container.innerHTML = '';

  const viewport = page.getViewport({ scale });
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  container.style.setProperty('--scale-factor', String(scale));
  container.style.setProperty('--user-unit', String(viewport.userUnit ?? 1));
  container.style.setProperty('--total-scale-factor', 'calc(var(--scale-factor) * var(--user-unit))');
  const textLayerBuilder = new TextLayerBuilder({
    pdfPage: page,
    onAppend: (textLayerDiv: HTMLDivElement) => {
      container.append(textLayerDiv);
    },
  });

  try {
    await textLayerBuilder.render({
      viewport,
      textContentParams: {
        includeMarkedContent: true,
        disableNormalization: true,
      },
    });
  } catch (err) {
    textLayerBuilder.cancel();
    container.innerHTML = '';
    throw err;
  }

  const textLayerElement = textLayerBuilder.div as HTMLDivElement;
  return {
    cancel: () => {
      textLayerBuilder.cancel();
    },
    destroy: () => {
      textLayerBuilder.cancel();
      container.innerHTML = '';
    },
    element: textLayerElement,
  };
}

export interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

export async function getTextContent(
  page: pdfjsLib.PDFPageProxy
): Promise<{ items: TextItem[]; styles: Record<string, any> }> {
  const textContent = await page.getTextContent();
  return textContent as { items: TextItem[]; styles: Record<string, any> };
}
