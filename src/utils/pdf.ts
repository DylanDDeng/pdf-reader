import * as pdfjsLib from 'pdfjs-dist';

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
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  const scaledWidth = Math.floor(viewport.width * outputScale);
  const scaledHeight = Math.floor(viewport.height * outputScale);
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  console.log('[DEBUG] renderPage called:', {
    scale,
    outputScale,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });

  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  console.log('[DEBUG] Canvas dimensions set:', {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    cssWidth: canvas.style.width,
    cssHeight: canvas.style.height,
  });

  const renderContext = {
    canvas: canvas,
    viewport: viewport,
    transform,
  };

  console.log('[DEBUG] Starting page.render()...');

  try {
    const renderTask = page.render(renderContext);
    await renderTask.promise;
    console.log('[DEBUG] page.render() completed successfully');
  } catch (err) {
    console.error('[DEBUG] page.render() failed:', err);
    throw err;
  }
}
