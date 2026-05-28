import { createHash } from 'node:crypto'
import { parseSync } from 'ofx-js'
import type { FetchParams, FetchResult, RawTransaction, TransactionSource } from '@splitwise/import-core'
import { OfxParseError } from './OfxParseError.js'

type OFXTrnType = string

function mapRawType(trntype: OFXTrnType): NonNullable<RawTransaction['rawType']> {
  switch (trntype) {
    case 'DEBIT':
    case 'ATM':
    case 'POS':
    case 'PAYMENT':
    case 'CASH':
    case 'CHECK':
      return 'DEBIT'
    case 'CREDIT':
    case 'DIRECTDEP':
    case 'INT':
    case 'DIV':
    case 'DEP':
      return 'CREDIT'
    case 'XFER':
      return 'TRANSFER'
    case 'FEE':
    case 'SRVCHG':
      return 'FEE'
    default:
      return 'OTHER'
  }
}

function parseOFXDate(dt: string): Date {
  // Formats: YYYYMMDD, YYYYMMDDHHMMSS, YYYYMMDDHHMMSS.mmm[±HH:MM]
  const clean = dt.replace(/[.+-].*$/, '').trim()
  const year = parseInt(clean.slice(0, 4), 10)
  const month = parseInt(clean.slice(4, 6), 10) - 1
  const day = parseInt(clean.slice(6, 8), 10)
  return new Date(Date.UTC(year, month, day))
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function normalizeDesc(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, ' ')
}

export class OfxFileAdapter implements TransactionSource {
  readonly id = 'ofx-file'
  readonly displayName = 'OFX File'

  constructor(
    private readonly fileBuffer: Buffer,
    private readonly institutionHint?: string,
  ) {}

  async fetch(_params: FetchParams): Promise<FetchResult> {
    let parsed: ReturnType<typeof parseSync>
    try {
      parsed = parseSync(this.fileBuffer.toString('utf-8'))
    } catch (e) {
      throw new OfxParseError('Failed to parse OFX buffer', e)
    }

    const ofx = parsed.OFX
    if (!ofx) throw new OfxParseError('OFX element not found in parsed output')

    // Support bank and credit card statement types
    const stmtrs =
      ofx?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS ??
      ofx?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS

    if (!stmtrs) throw new OfxParseError('No STMTRS or CCSTMTRS found in OFX document')

    const currency = (stmtrs.CURDEF as string | undefined) ?? 'BRL'
    const org =
      (ofx?.SIGNONMSGSRSV1?.SONRS?.FI?.ORG as string | undefined) ??
      this.institutionHint ??
      'Unknown'

    const tranList = stmtrs.BANKTRANLIST
    if (!tranList) {
      return {
        transactions: [],
        effectiveRange: { from: new Date(), to: new Date() },
        warnings: ['No BANKTRANLIST found — empty statement'],
      }
    }

    const dtStart = parseOFXDate(tranList.DTSTART as string)
    const dtEnd = parseOFXDate(tranList.DTEND as string)

    const rawTrns = tranList.STMTTRN
    const stmtTrns = !rawTrns
      ? []
      : Array.isArray(rawTrns)
      ? rawTrns
      : [rawTrns]

    const warnings: string[] = []
    let missingFitidCount = 0

    const transactions: RawTransaction[] = stmtTrns.map((trn) => {
      const fitid = trn.FITID as string | undefined
      const dtposted = trn.DTPOSTED as string
      const trnamt = trn.TRNAMT as string
      const memo = (trn.MEMO ?? trn.NAME ?? '') as string
      const trntype = (trn.TRNTYPE ?? 'OTHER') as string

      // OFX: negative = debit/outflow. Invert per ADR-003 (positive = outflow).
      const amountCents = Math.round(parseFloat(trnamt) * -100)

      // Prefer FITID; fall back to hash when absent (Itaú older statements — CLAUDE.md §6)
      let externalId: string
      if (fitid && fitid.trim()) {
        externalId = fitid.trim()
      } else {
        missingFitidCount++
        const occurredIso = parseOFXDate(dtposted).toISOString().split('T')[0]!
        externalId = sha256(`${occurredIso}|${Math.abs(amountCents)}|${normalizeDesc(memo)}`)
      }

      return {
        externalId,
        occurredAt: parseOFXDate(dtposted),
        amountCents,
        description: memo,
        currency: 'BRL',
        sourceInstitution: org,
        rawType: mapRawType(trntype),
        metadata: { trntype, currency },
      }
    })

    if (missingFitidCount > 0) {
      warnings.push(`FITID absent for ${missingFitidCount} transaction(s), hash generated`)
    }

    return { transactions, effectiveRange: { from: dtStart, to: dtEnd }, warnings }
  }
}
