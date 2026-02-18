export interface ArxivPaperMetadata {
  arxiv_id: string;
  version: number;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  updated: string;
  abs_url: string;
  pdf_url: string;
}

export interface ArxivImportRequest {
  input_url_or_id: string;
  target_dir: string;
  conflict_policy: 'skip';
}

export interface ArxivImportResult {
  status: 'downloaded' | 'skipped';
  reason?: string;
  pdf_path?: string;
  pdf_size?: number;
  metadata_path?: string;
  paper?: ArxivPaperMetadata;
}

export interface ArxivImportOutcome {
  status: 'downloaded' | 'skipped' | 'error';
  message: string;
  paperTitle?: string;
  pdfPath?: string;
}

