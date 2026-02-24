import type { PDFDocumentProxy } from 'pdfjs-dist';

export async function extractPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  let lastY: number | null = null;
  let text = '';

  for (const item of content.items) {
    if (!('str' in item)) continue;
    const typedItem = item as { str: string; transform: number[] };
    const y = typedItem.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      text += '\n';
    }
    text += typedItem.str;
    lastY = y;
  }

  return text.trim();
}

export async function extractDocumentText(
  doc: PDFDocumentProxy,
  options?: { maxChars?: number }
): Promise<{ text: string; truncated: boolean }> {
  const maxChars = options?.maxChars ?? 80_000;
  const totalPages = doc.numPages;
  let text = '';
  let truncated = false;

  for (let i = 1; i <= totalPages; i++) {
    const pageText = await extractPageText(doc, i);
    if (text.length + pageText.length + 20 > maxChars) {
      const remaining = maxChars - text.length - 20;
      if (remaining > 0) {
        text += `\n\n--- Page ${i} ---\n` + pageText.slice(0, remaining);
      }
      truncated = true;
      break;
    }
    text += `\n\n--- Page ${i} ---\n` + pageText;
  }

  return { text: text.trim(), truncated };
}
