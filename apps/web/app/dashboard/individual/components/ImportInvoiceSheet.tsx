'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { processImport, confirmImport } from '@/app/dashboard/import/actions'
import type { ImportPreview, ReviewRow } from '@/app/dashboard/import/types'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-') as [string, string]
  return `${MONTHS[parseInt(m, 10) - 1]!} ${y}`
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}R$ ${(abs / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function buildReviewRows(pv: ImportPreview): ReviewRow[] {
  return pv.transactions.map((t, i) => ({
    idx: i,
    externalId: t.raw.externalId,
    occurredAt:
      t.raw.occurredAt instanceof Date
        ? t.raw.occurredAt.toISOString().split('T')[0]!
        : String(t.raw.occurredAt).split('T')[0]!,
    description: t.raw.description,
    amountFormatted: formatCents(t.raw.amountCents),
    amountCents: t.raw.amountCents,
    categoryId: t.categoryId,
    categoryConfidence: t.categoryConfidence,
    categorySource: t.categorySource,
    splitRule: t.splitRule,
    excluded: false,
    sourceId: t.sourceId,
    installment:
      (t.raw.metadata?.installment as { current: number; total: number } | null | undefined) ?? null,
  }))
}

type Step = 1 | 2 | 3 | 4

type Props = {
  currentMonth: string
  trigger: React.ReactNode
}

export default function ImportInvoiceDialog({ currentMonth, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [pdfCostWarningPending, setPdfCostWarningPending] = useState(false)

  function reset() {
    setStep(1)
    setFile(null)
    setLoading(false)
    setError(null)
    setPreview(null)
    setRows([])
    setImportResult(null)
    setPdfCostWarningPending(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleProcess() {
    if (!file) return
    setLoading(true)
    setError(null)
    setStep(2)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', 'itau')

    const result = await processImport(fd)
    setLoading(false)

    if (!result.success) {
      setError(
        result.error === 'plan_limit'
          ? 'Seu plano não permite importar este período.'
          : result.error,
      )
      setStep(1)
      return
    }

    const pv = result.preview
    setPreview(pv)
    const reviewRows = buildReviewRows(pv)
    reviewRows.sort((a, b) => a.categoryConfidence - b.categoryConfidence)
    setRows(reviewRows)
    setStep(3)
  }

  async function handleConfirm() {
    if (!preview) return
    setLoading(true)
    setError(null)

    const result = await confirmImport(rows, preview.householdId, currentMonth)
    setLoading(false)

    if (!result.success) { setError(result.error); return }

    setImportResult({ imported: result.imported, skipped: result.skipped })
    setStep(4)
    router.refresh()
  }

  const includedRows = rows.filter((r) => !r.excluded)
  const included = includedRows.length
  const purchaseCents = includedRows.filter((r) => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0)
  const creditCents = includedRows.filter((r) => r.amountCents < 0).reduce((s, r) => s + Math.abs(r.amountCents), 0)
  const netCents = purchaseCents - creditCents

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent
        className={
          step === 3
            ? '[display:flex] flex-col max-w-[calc(100vw-40px)] w-[calc(100vw-40px)] h-[calc(100vh-40px)] max-h-[calc(100vh-40px)]'
            : 'max-w-lg'
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 3
              ? `Revisar fatura — ${formatMonth(currentMonth)}`
              : `Importar fatura — ${formatMonth(currentMonth)}`}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1 — Upload ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f?.name.endsWith('.pdf')) { setFile(f); setPdfCostWarningPending(false) }
              }}
              onClick={() => document.getElementById('invoice-file-input')?.click()}
            >
              <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Arraste o PDF da fatura aqui, ou clique para selecionar
                </p>
              )}
              <input
                id="invoice-file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setPdfCostWarningPending(false)
                }}
              />
            </div>

            {pdfCostWarningPending && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium mb-2">
                  A extração por IA custa ~$0,05–$0,15 por página. Continuar?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => { setPdfCostWarningPending(false); await handleProcess() }}
                  >
                    Continuar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPdfCostWarningPending(false); setFile(null) }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!pdfCostWarningPending && (
              <Button
                className="w-full"
                disabled={!file || loading}
                onClick={() => setPdfCostWarningPending(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Processar fatura
              </Button>
            )}
          </div>
        )}

        {/* ── Step 2 — Processing ── */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">
              Lendo fatura com IA… Isso pode levar até 15 segundos.
            </p>
          </div>
        )}

        {/* ── Step 3 — Review ── */}
        {step === 3 && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Compras:{' '}
                <span className="font-medium text-foreground">
                  R$ {(purchaseCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </span>
              {creditCents > 0 && (
                <span className="text-muted-foreground">
                  Créditos:{' '}
                  <span className="font-medium text-green-600">
                    −R$ {(creditCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </span>
              )}
              <span className="text-muted-foreground">
                Total:{' '}
                <span className="font-semibold text-foreground">
                  R$ {(netCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>

            {preview?.warnings && preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="rounded-md border overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={rows.every((r) => !r.excluded)}
                        onChange={(e) =>
                          setRows(rows.map((r) => ({ ...r, excluded: !e.target.checked })))
                        }
                        className="h-4 w-4"
                      />
                    </th>
                    <th className="p-2 text-left text-xs">Data</th>
                    <th className="p-2 text-left text-xs">Descrição</th>
                    <th className="p-2 text-right text-xs">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.idx} className={`border-t ${row.excluded ? 'opacity-40' : ''}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!row.excluded}
                          onChange={() =>
                            setRows(rows.map((r) =>
                              r.idx === row.idx ? { ...r, excluded: !r.excluded } : r,
                            ))
                          }
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{row.occurredAt}</td>
                      <td className="p-2 text-xs max-w-xs truncate" title={row.description}>
                        {row.description}
                        {row.installment && (
                          <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                            {row.installment.current}/{row.installment.total}
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-2 text-right text-xs font-medium tabular-nums ${
                          row.amountCents > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {row.amountFormatted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setStep(1); setFile(null); setRows([]) }}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={included === 0 || loading}
                onClick={handleConfirm}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando…</>
                ) : (
                  `Importar ${included} lançamentos`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4 — Done ── */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Fatura importada!</h2>
            {importResult && (
              <p className="text-muted-foreground text-center">
                {importResult.imported} lançamentos importados
                {importResult.skipped > 0 && ` · ${importResult.skipped} ignorados`}
              </p>
            )}
            <Button onClick={() => { reset(); setOpen(false) }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
