export type OpenFileLocationMode = 'last_read_page' | 'first_page';
export type DefaultZoomMode = 'fit_width' | 'fixed_100' | 'remember_last';

export interface ReaderSettings {
  openFileLocation: OpenFileLocationMode;
  defaultZoomMode: DefaultZoomMode;
  arxivDownloadFolder: string | null;
}
