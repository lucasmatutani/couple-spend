'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { processImport, confirmImport, importFromConnectedAccount } from '../actions'
import type { ConnectedAccountSummary } from '../page'
import type { ImportPreview, ReviewRow } from '../types'

type Step = 1 | 2 | 3 | 4

const CONFIDENCE_BADGE: Record<string, string> = {
  rule: 'bg-green-100 text-green-800',
  memory: 'bg-blue-100 text-blue-800',
  llm: 'bg-purple-100 text-purple-800',
  default: 'bg-amber-100 text-amber-800',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  rule: 'Regra',
  memory: 'Memória',
  llm: 'IA',
  default: 'Padrão',
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}R$ ${(abs / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

type Props = {
  searchParamsPromise: Promise<{ step?: string }>
  connectedAccounts?: ConnectedAccountSummary[]
}

export default function ImportWizard({ searchParamsPromise, connectedAccounts = [] }: Props) {
  const params = use(searchParamsPromise)
  const [step, setStep] = useState<Step>((parseInt(params.step ?? '1') as Step) || 1)
  const [file, setFile] = useState<File | null>(null)
  const [mapping, setMapping] = useState('itau')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [planLimit, setPlanLimit] = useState(false)
  const [pdfCostWarningPending, setPdfCostWarningPending] = useState(false)
  const [isPdfImport, setIsPdfImport] = useState(false)
  const router = useRouter()

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      setPdfCostWarningPending(false)
    }
  }

  function buildReviewRows(pv: ImportPreview): ReviewRow[] {
    return pv.transactions.map((t, i) => ({
      idx: i,
      externalId: t.raw.externalId,
      occurredAt: t.raw.occurredAt instanceof Date
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
      installment: (t.raw.metadata?.installment as { current: number; total: number } | null | undefined) ?? null,
    }))
  }

  async function handleProcess() {
    if (!file) return
    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', mapping)

    const result = await processImport(fd)
    setLoading(false)

    if (!result.success) {
      if (result.error === 'plan_limit') { setPlanLimit(true); setStep(1) }
      else setError(result.error)
      return
    }

    const pv = result.preview
    setPreview(pv)

    const reviewRows = buildReviewRows(pv)
    reviewRows.sort((a, b) => a.categoryConfidence - b.categoryConfidence)
    setRows(reviewRows)
    setStep(3)
  }

  async function startProcess() {
    setPlanLimit(false)
    setIsPdfImport(file?.name.endsWith('.pdf') ?? false)
    setStep(2)
    await handleProcess()
  }

  async function handleConfirm() {
    if (!preview) return
    setLoading(true)
    setError(null)

    const result = await confirmImport(rows, preview.householdId)
    setLoading(false)

    if (!result.success) { setError(result.error); return }

    setImportResult({ imported: result.imported, skipped: result.skipped })
    setStep(4)
  }

  async function handleConnectedAccountImport(accountId: string) {
    setLoading(true)
    setError(null)
    setPlanLimit(false)
    setStep(2)

    const result = await importFromConnectedAccount(accountId)
    setLoading(false)

    if (!result.success) {
      if (result.error === 'plan_limit') { setPlanLimit(true); setStep(1) }
      else { setError(result.error); setStep(1) }
      return
    }

    const pv = result.preview
    setPreview(pv)

    const reviewRows = buildReviewRows(pv)
    reviewRows.sort((a, b) => a.categoryConfidence - b.categoryConfidence)
    setRows(reviewRows)
    setStep(3)
  }

  // Step 1 — Upload
  if (step === 1) {
    const isOfx = file?.name.endsWith('.ofx')
    const isCsv = file?.name.endsWith('.csv')
    const isPdf = file?.name.endsWith('.pdf')
    return (
      <div className="space-y-6 max-w-xl">
        <h2 className="text-2xl font-bold">Importar transações</h2>

        {connectedAccounts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Open Finance</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {connectedAccounts.map((account) => (
                <Button
                  key={account.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => handleConnectedAccountImport(account.id)}
                >
                  Importar de {account.institution_name}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Selecionar arquivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Arraste um arquivo .ofx, .csv ou .pdf aqui, ou clique para selecionar</p>
              )}
              <input
                id="file-input"
                type="file"
                accept=".ofx,.csv,.pdf"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setPdfCostWarningPending(false)
                }}
              />
            </div>

            {file && isCsv && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Formato do CSV</p>
                <Select value={mapping} onValueChange={setMapping}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="itau">Itaú</SelectItem>
                    <SelectItem value="picpay">PicPay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {pdfCostWarningPending && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium mb-2">⚠ A extração por IA custa ~$0,05–$0,15 por página. Continuar?</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      setPdfCostWarningPending(false)
                      await startProcess()
                    }}
                  >
                    Continuar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPdfCostWarningPending(false)
                      setFile(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {planLimit && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Seu plano atual não permite importar transações deste período.{' '}
                <a href="/dashboard/billing" className="font-medium underline underline-offset-2">
                  Fazer upgrade
                </a>{' '}
                para desbloquear mais histórico.
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!pdfCostWarningPending && (
              <Button
                className="w-full"
                disabled={!file || loading}
                onClick={() => {
                  if (isPdf) {
                    setPdfCostWarningPending(true)
                  } else {
                    startProcess()
                  }
                }}
              >
                Processar arquivo
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2 — Processing
  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {isPdfImport
            ? 'Lendo fatura com IA... Isso pode levar até 15 segundos.'
            : 'Processando arquivo...'}
        </p>
        {error && (
          <div className="space-y-2 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setStep(1); setError(null) }}>
              Voltar
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Step 3 — Review
  if (step === 3) {
    const includedRows = rows.filter((r) => !r.excluded)
    const included = includedRows.length
    const purchaseCents = includedRows.filter((r) => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0)
    const creditCents = includedRows.filter((r) => r.amountCents < 0).reduce((s, r) => s + Math.abs(r.amountCents), 0)
    const netCents = purchaseCents - creditCents

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Revisar transações</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep(1); setFile(null); setRows([]) }}>
              Cancelar
            </Button>
            <Button disabled={included === 0 || loading} onClick={handleConfirm}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</> : `Importar ${included} transações`}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Compras: <span className="font-medium text-foreground">
              R$ {(purchaseCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </span>
          {creditCents > 0 && (
            <span className="text-muted-foreground">
              Créditos: <span className="font-medium text-green-600">
                −R$ {(creditCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </span>
          )}
          <span className="text-muted-foreground">
            Total da fatura: <span className="font-semibold text-foreground">
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

        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={rows.every((r) => !r.excluded)}
                    onChange={(e) => setRows(rows.map((r) => ({ ...r, excluded: !e.target.checked })))}
                    className="h-4 w-4"
                  />
                </th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-right">Valor</th>
                <th className="p-2 text-left">Categoria</th>
                <th className="p-2 text-left">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.idx}
                  className={[
                    'border-t',
                    row.excluded ? 'opacity-40' : '',
                    row.categoryConfidence < 0.7 ? 'bg-amber-50/50' : '',
                  ].join(' ')}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={!row.excluded}
                      onChange={(e) =>
                        setRows(rows.map((r) => r.idx === row.idx ? { ...r, excluded: !e.target.checked } : r))
                      }
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="p-2 text-muted-foreground">{row.occurredAt}</td>
                  <td className="p-2 max-w-xs truncate" title={row.description}>
                    {row.description}
                    {row.installment && (
                      <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                        {row.installment.current}/{row.installment.total}
                      </span>
                    )}
                  </td>
                  <td className={`p-2 text-right font-medium tabular-nums ${row.amountCents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {row.amountFormatted}
                  </td>
                  <td className="p-2">
                    <span className="text-xs text-muted-foreground">{row.categoryId}</span>
                  </td>
                  <td className="p-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_BADGE[row.categorySource] ?? ''}`}>
                      {CONFIDENCE_LABEL[row.categorySource] ?? row.categorySource}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Step 4 — Done
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <CheckCircle className="h-12 w-12 text-green-500" />
      <h2 className="text-xl font-semibold">Importação concluída</h2>
      {importResult && (
        <p className="text-muted-foreground text-center">
          {importResult.imported} transações importadas · {importResult.skipped} ignoradas (duplicatas ou excluídas)
        </p>
      )}
      <Button onClick={() => router.push('/dashboard/household')}>
        Ver despesas da casa
      </Button>
    </div>
  )
}
