import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Banknote,
  Import,
  LineChart,
  ShieldCheck,
  SplitSquareHorizontal,
  Target,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { FadeUp, StaggerItem, StaggerList } from '@/components/ui/animated'

type Props = {
  searchParams: Promise<{ code?: string; next?: string }>
}

const FEATURES = [
  {
    Icon: SplitSquareHorizontal,
    title: 'Divisão de despesas flexível',
    description:
      'Divida contas igualmente, só com quem pagou, ou com percentuais customizados. As regras se adaptam ao tamanho da sua casa.',
  },
  {
    Icon: Users,
    title: 'Visão da casa e individual',
    description:
      'Veja os gastos compartilhados com todos os membros e mantenha sua renda, despesas e investimentos pessoais totalmente privados.',
  },
  {
    Icon: Import,
    title: 'Importação de extratos',
    description:
      'Importe extratos OFX e CSV do seu banco. As transações duplicadas são detectadas automaticamente.',
  },
  {
    Icon: Banknote,
    title: 'Categorização automática',
    description:
      'O sistema aprende com suas categorizações anteriores e sugere categorias para novas transações.',
  },
  {
    Icon: Target,
    title: 'Metas financeiras',
    description:
      'Defina metas de economia ou investimento mínimo e acompanhe se está no caminho certo mês a mês.',
  },
  {
    Icon: LineChart,
    title: 'Projeção de 12 meses',
    description:
      'Entenda quanto da sua renda está sendo gasto e projete sua sobra e capacidade de investimento futura.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Crie sua casa',
    description: 'Configure sua Household em segundos e convide quem divide as contas com você.',
  },
  {
    number: '02',
    title: 'Registre e importe',
    description: 'Lance despesas manualmente ou importe extratos do banco — nada de planilha.',
  },
  {
    number: '03',
    title: 'Acompanhe o resultado',
    description: 'Veja o saldo entre os membros, sua renda comprometida e o progresso das suas metas.',
  },
]

export default async function Home({ searchParams }: Props) {
  const { code, next } = await searchParams

  // Supabase falls back to site_url when emailRedirectTo isn't in the allow-list,
  // landing ?code= here instead of /auth/callback. Forward it transparently.
  if (code) {
    const qs = next ? `?code=${code}&next=${next}` : `?code=${code}`
    redirect(`/auth/callback${qs}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Splitwise</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/login">
              <Button>Começar agora</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <FadeUp className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Divisão de despesas + finanças pessoais
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance md:text-6xl">
              Divida contas com quem mora com você. Cuide do seu dinheiro sozinho.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground text-balance md:text-xl">
              Troque a planilha compartilhada por uma plataforma que divide as despesas da casa
              automaticamente e mantém sua renda, gastos e investimentos privados.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Criar minha casa <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Já tenho uma conta
                </Button>
              </Link>
            </div>
          </FadeUp>
        </section>

        {/* Features */}
        <section className="border-t bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <FadeUp className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Tudo que sua casa precisa para organizar as finanças
              </h2>
              <p className="mt-4 text-muted-foreground">
                Despesas compartilhadas de um lado, vida financeira pessoal do outro — sem
                misturar os dois.
              </p>
            </FadeUp>

            <StaggerList className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ Icon, title, description }) => (
                <StaggerItem key={title}>
                  <Card className="h-full transition-colors hover:border-primary/40">
                    <CardHeader>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                        <Icon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <CardTitle className="text-lg">{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                    </CardHeader>
                    <CardContent />
                  </Card>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <FadeUp className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Como funciona</h2>
            <p className="mt-4 text-muted-foreground">
              Três passos para sair da planilha e ter visibilidade real dos seus gastos.
            </p>
          </FadeUp>

          <StaggerList className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map(({ number, title, description }) => (
              <StaggerItem key={number}>
                <div className="relative">
                  <span className="text-5xl font-bold text-accent-foreground/20">{number}</span>
                  <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        </section>

        {/* Privacy callout */}
        <section className="border-t bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <FadeUp className="flex flex-col items-start gap-6 rounded-2xl border bg-card p-8 md:flex-row md:items-center md:p-12">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                <ShieldCheck className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Privacidade entre membros por padrão</h3>
                <p className="mt-2 text-muted-foreground">
                  Sua renda, seus gastos pessoais e seus investimentos nunca ficam visíveis para
                  outros membros da casa. Só o que é compartilhado, é compartilhado.
                </p>
              </div>
            </FadeUp>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <FadeUp>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Pronto para organizar as contas da sua casa?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Crie sua casa gratuitamente e convide quem divide as despesas com você.
            </p>
            <div className="mt-8">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeUp>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Splitwise</span>
          <span>Divisão de despesas e finanças pessoais para qualquer tipo de casa.</span>
        </div>
      </footer>
    </div>
  )
}
