'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'magic-link' | 'password'
type View = 'login' | 'signup' | 'forgot-password' | 'magic-link-sent' | 'reset-sent' | 'signup-sent'

interface LoginFormProps {
  next: string
}

export default function LoginForm({ next }: LoginFormProps) {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('magic-link')
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setView('magic-link-sent')
    setLoading(false)
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push(next)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (signUpError) {
      setError('Não foi possível criar a conta. Tente novamente.')
      setLoading(false)
      return
    }
    if (data.session) {
      router.push(next)
      return
    }
    setView('signup-sent')
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/auth/update-password')}`,
    })
    setView('reset-sent')
    setLoading(false)
  }

  if (view === 'magic-link-sent') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>Enviamos um link de acesso para {email}.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (view === 'reset-sent') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um link para redefinir sua senha para {email}.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (view === 'signup-sent') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um link de confirmação para {email}. Clique nele para ativar sua conta.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (view === 'signup') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Insira seus dados para criar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">E-mail</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Senha</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-confirm">Confirmar senha</Label>
              <Input
                id="signup-confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>
            <button
              type="button"
              onClick={() => { setView('login'); setError('') }}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Já tem uma conta? Entrar
            </button>
          </form>
        </CardContent>
      </Card>
    )
  }

  if (view === 'forgot-password') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>
            Insira seu e-mail para receber um link de redefinição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
            <button
              type="button"
              onClick={() => setView('login')}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Voltar ao login
            </button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          {mode === 'magic-link'
            ? 'Insira seu e-mail para receber um link de acesso.'
            : 'Insira seu e-mail e senha para entrar.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex rounded-lg border p-1 gap-1">
          <button
            type="button"
            onClick={() => switchMode('magic-link')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'magic-link'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Link mágico
          </button>
          <button
            type="button"
            onClick={() => switchMode('password')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'password'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Senha
          </button>
        </div>

        {mode === 'magic-link' ? (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de acesso'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <button
              type="button"
              onClick={() => setView('forgot-password')}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Esqueceu sua senha?
            </button>
            <button
              type="button"
              onClick={() => { setView('signup'); setError('') }}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Não tem uma conta? Criar conta
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
