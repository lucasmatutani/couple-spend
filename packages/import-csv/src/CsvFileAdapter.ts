import { createHash } from 'node:crypto'
import Papa from 'papaparse'
import type { FetchParams, FetchResult, RawTransaction, TransactionSource } from '@splitwise/import-core'

export type CsvColumnMapping = {
  date: string
  description: string
  amount: string
  type?: string
}

export const ITAU_MAPPING: CsvColumnMapping = {
  date: 'Data',
  description: 'Histórico',
  amount: 'Valor',
}

export const PICPAY_MAPPING: CsvColumnMapping = {
  date: 'Data',
  description: 'Descrição',
  amount: 'Valor',
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function normalizeDesc(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Parse Brazilian (1.234,56) or US (1234.56) decimal formats → integer cents. Returns NaN on failure. */
function parseAmountCents(raw: string): number {
  const s = raw.trim().replace(/\s/g, '')
  let numeric: number
  // Brazilian format: thousands separator is '.', decimal separator is ','
  // e.g. "-150,00" or "5.000,00"
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    numeric = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  } else {
    // US format or plain decimal: "-32.00" or "1234.56"
    numeric = parseFloat(s.replace(/,/g, ''))
  }
  if (isNaN(numeric)) return NaN
  return Math.round(numeric * 100)
}

/** Parse DD/MM/YYYY date string */
function parseDateDDMMYYYY(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  const year = parseInt(m[3]!, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export class CsvFileAdapter implements TransactionSource {
  readonly id = 'csv-file'
  readonly displayName = 'CSV File'

  constructor(
    private readonly fileBuffer: Buffer,
    private readonly columnMapping: CsvColumnMapping,
    private readonly institutionHint: string,
  ) {}

  async fetch(_params: FetchParams): Promise<FetchResult> {
    // Strip BOM (﻿) — CLAUDE.md §6 pitfall (PicPay CSV)
    const raw = this.fileBuffer.toString('utf-8').replace(/^﻿/, '')

    const result = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
    })

    const warnings: string[] = [...result.errors.map((e) => `CSV parse error: ${e.message}`)]
    const { date: dateCol, description: descCol, amount: amountCol } = this.columnMapping

    const transactions: RawTransaction[] = []
    let minDate: Date | null = null
    let maxDate: Date | null = null

    for (const [rowIdx, row] of result.data.entries()) {
      const rawDate = row[dateCol]
      const rawDesc = row[descCol]
      const rawAmount = row[amountCol]

      if (!rawDate || !rawDesc || !rawAmount) {
        warnings.push(`Row ${rowIdx + 2}: missing required column(s), skipped`)
        continue
      }

      const occurredAt = parseDateDDMMYYYY(rawDate)
      if (!occurredAt) {
        warnings.push(`Row ${rowIdx + 2}: invalid date "${rawDate}", skipped`)
        continue
      }

      const parsedCents = parseAmountCents(rawAmount)
      if (isNaN(parsedCents)) {
        warnings.push(`Row ${rowIdx + 2}: invalid amount "${rawAmount}", skipped`)
        continue
      }
      // Invert sign per ADR-003 (source typically uses negative for expense/debit)
      const amountCents = -parsedCents

      const dateIso = occurredAt.toISOString().split('T')[0]!
      const externalId = sha256(`${dateIso}|${Math.abs(amountCents)}|${normalizeDesc(rawDesc)}`)

      if (!minDate || occurredAt < minDate) minDate = occurredAt
      if (!maxDate || occurredAt > maxDate) maxDate = occurredAt

      transactions.push({
        externalId,
        occurredAt,
        amountCents,
        description: rawDesc.trim(),
        currency: 'BRL',
        sourceInstitution: this.institutionHint,
      })
    }

    const fallback = new Date()
    return {
      transactions,
      effectiveRange: { from: minDate ?? fallback, to: maxDate ?? fallback },
      warnings,
    }
  }
}
