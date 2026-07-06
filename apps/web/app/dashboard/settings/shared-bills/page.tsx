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
    .select('id, keyword')
    .order('created_at', { ascending: true })

  async function handleAdd(formData: FormData) {
    'use server'
    await addSharedBillKeyword({ keyword: formData.get('keyword') })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Contas fixas compartilhadas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre palavras que identificam contas recorrentes da fatura do cartão que já são
          sempre divididas com o parceiro (aluguel, condomínio, internet, assinaturas, etc.).
          Ao importar uma fatura em PDF, transações que combinarem com uma dessas palavras já
          entram marcadas como divididas — sem precisar editar todo mês.
        </p>
      </div>

      {keywords && keywords.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Palavras-chave cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <SharedBillKeywordsList keywords={keywords} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">Nenhuma palavra-chave cadastrada ainda.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar palavra-chave</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAdd} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="keyword">Palavra-chave</Label>
              <Input
                id="keyword"
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
  )
}
