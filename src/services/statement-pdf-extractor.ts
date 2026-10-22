import { Platform } from 'react-native';
import {
  getStatementPdfModule,
  type ExtractedStatementPdf,
} from '../../modules/statement-pdf';

export type { ExtractedStatementPdf, PdfTextItem, PdfTextPage } from '../../modules/statement-pdf';

const UNAVAILABLE = 'A importação de PDF precisa de um development build Android atualizado. OFX e CSV continuam disponíveis.';
const FAILURE = 'Não foi possível ler este PDF. Use um PDF com texto, sem senha, de até 5 MB e 30 páginas, ou importe OFX/CSV.';

export async function extractStatementPdf(uri: string): Promise<ExtractedStatementPdf> {
  if (Platform.OS !== 'android') throw new Error(UNAVAILABLE);
  const nativeModule = getStatementPdfModule();
  if (!nativeModule) throw new Error(UNAVAILABLE);
  try {
    return await nativeModule.extractTextAsync(uri);
  } catch (error) {
    // Never propagate native causes: PDF parser failures may include paths or document content.
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ERR_STATEMENT_PDF_PROTECTED') throw new Error('PDF protegido por senha ou criptografia. Selecione um extrato sem proteção ou use OFX/CSV.');
    if (code === 'ERR_STATEMENT_PDF_NO_TEXT') throw new Error('PDF sem texto extraível. OCR não está disponível; use um PDF textual ou OFX/CSV.');
    throw new Error(FAILURE);
  }
}
