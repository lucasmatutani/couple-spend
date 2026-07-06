import { OfxFileAdapter } from '@splitwise/import-ofx'
import { CsvFileAdapter, type CsvColumnMapping } from '@splitwise/import-csv'
import { PluggyAdapter, getPluggyClient } from '@splitwise/import-open-finance'
import { PdfInvoiceAdapter, GeminiPdfAdapter, type CategoryDef } from '@splitwise/import-pdf'
import { getAnthropicClient } from './anthropic'
import { getGeminiClient } from './gemini'

function pluggyClientId(): string { return process.env.PLUGGY_CLIENT_ID! }
function pluggyClientSecret(): string { return process.env.PLUGGY_CLIENT_SECRET! }

export function getOfxSource(buffer: Buffer): OfxFileAdapter {
  return new OfxFileAdapter(buffer)
}

export function getCsvSource(buffer: Buffer, mapping: CsvColumnMapping, hint?: string): CsvFileAdapter {
  return new CsvFileAdapter(buffer, mapping, hint ?? 'Importado')
}

export function getPdfSource(
  buffer: Buffer,
  categories: CategoryDef[],
  sharedBillKeywords: string[] = [],
  institutionHint?: string,
): PdfInvoiceAdapter | GeminiPdfAdapter {
  if (process.env.PDF_EXTRACTOR === 'gemini') {
    return new GeminiPdfAdapter(buffer, getGeminiClient(), institutionHint, categories, sharedBillKeywords)
  }
  return new PdfInvoiceAdapter(buffer, getAnthropicClient(), institutionHint, categories, sharedBillKeywords)
}

export function getOpenFinanceSource(itemId: string, institutionName: string): PluggyAdapter {
  const client = getPluggyClient(pluggyClientId(), pluggyClientSecret())
  return new PluggyAdapter(client, itemId, institutionName)
}
