import { OfxFileAdapter } from '@splitwise/import-ofx'
import { CsvFileAdapter, type CsvColumnMapping } from '@splitwise/import-csv'
import { PluggyAdapter, getPluggyClient } from '@splitwise/import-open-finance'

function pluggyClientId(): string { return process.env.PLUGGY_CLIENT_ID! }
function pluggyClientSecret(): string { return process.env.PLUGGY_CLIENT_SECRET! }

export function getOfxSource(buffer: Buffer): OfxFileAdapter {
  return new OfxFileAdapter(buffer)
}

export function getCsvSource(buffer: Buffer, mapping: CsvColumnMapping, hint?: string): CsvFileAdapter {
  return new CsvFileAdapter(buffer, mapping, hint ?? 'Importado')
}

export function getOpenFinanceSource(itemId: string, institutionName: string): PluggyAdapter {
  const client = getPluggyClient(pluggyClientId(), pluggyClientSecret())
  return new PluggyAdapter(client, itemId, institutionName)
}
