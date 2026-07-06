import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addSharedBillKeyword } from './actions'
import SharedBillKeywordsList from './SharedBillKeywordsList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function SharedBillsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: keywords } = await supabase
    .from('shared_bill_keywords')
    .select('id, keyword, kind')
    .order('created_at', { ascending: true })

  const splitKeywords = (keywords ?? []).filter((k) => k.kind === 'split')
  const reimbursedKeywords = (keywords ?? []).filter((k) => k.kind === 'reimbursed')

  async function handleAdd(formData: FormData) {
    'use server'
    await addSharedBillKeyword({ keyword: formData.get('keyword'), kind: formData.get('kind') })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Contas fixas compartilhadas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre palavras que identificam contas recorrentes da fatura do cartão. Ao importar
          uma fatura em PDF, transações que combinarem com uma dessas palavras já entram
          marcadas automaticamente — sem precisar editar todo mês.
        </p>
      </div>

      {/* ── Divididas com o parceiro ────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Divididas com o parceiro</h3>
          <p className="text-sm text-muted-foreground">
            Contas que já são sempre divididas com o parceiro (aluguel, condomínio, internet,
            assinaturas, etc.).
          </p>
        </div>

        {splitKeywords.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Palavras-chave cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <SharedBillKeywordsList keywords={splitKeywords} />
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma palavra-chave cadastrada ainda.</p>
        )}

        <Card>
          <CardContent className="pt-6">
            <form action={handleAdd} className="flex items-end gap-3">
              <input type="hidden" name="kind" value="split" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="split-keyword">Palavra-chave</Label>
                <Input
                  id="split-keyword"
                  name="keyword"
                  placeholder="Ex.: Netflix, Condomínio, Internet"
                  maxLength={60}
                  required
                />
              </div>
              <Button type="submit">Adicionar</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Reembolso total ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Reembolso total</h3>
          <p className="text-sm text-muted-foreground">
            Contas que você paga integralmente no cartão, mas recebe reembolso total de
            terceiros (ex.: empresa, plano de saúde). Entram já marcadas como reembolsadas,
            com custo zero para você.
          </p>
        </div>

        {reimbursedKeywords.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Palavras-chave cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <SharedBillKeywordsList keywords={reimbursedKeywords} />
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma palavra-chave cadastrada ainda.</p>
        )}

        <Card>
          <CardContent className="pt-6">
            <form action={handleAdd} className="flex items-end gap-3">
              <input type="hidden" name="kind" value="reimbursed" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="reimbursed-keyword">Palavra-chave</Label>
                <Input
                  id="reimbursed-keyword"
                  name="keyword"
                  placeholder="Ex.: Plano de Saúde, Viagem a trabalho"
                  maxLength={60}
                  required
                />
              </div>
              <Button type="submit">Adicionar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
