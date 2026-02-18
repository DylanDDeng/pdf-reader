export type OpenFileLocationMode = 'last_read_page' | 'first_page';

export interface ReaderSettings {
  openFileLocation: OpenFileLocationMode;
  arxivDownloadFolder: string | null;
}
