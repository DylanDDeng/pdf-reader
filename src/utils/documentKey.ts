export function getDocumentKey(file: File | string): string {
  if (typeof file === 'string') {
    return `path:${file}`;
  }

  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

