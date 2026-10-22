import { requireOptionalNativeModule } from 'expo';

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextPage {
  page: number;
  width: number;
  height: number;
  items: PdfTextItem[];
}

export interface ExtractedStatementPdf {
  pages: PdfTextPage[];
}

interface StatementPdfModule {
  extractTextAsync(uri: string): Promise<ExtractedStatementPdf>;
}

// Resolve lazily so importing the service remains safe in Expo Go and on unsupported platforms.
export function getStatementPdfModule(): StatementPdfModule | null {
  return requireOptionalNativeModule<StatementPdfModule>('WalletStatementPdf');
}
