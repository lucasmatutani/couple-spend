'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { Loader2, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { initiateConnection, saveConnection, disconnectAccount } from './actions'

type ConnectedAccount = {
  id: string
  institution_name: string
  status: string
  last_synced_at: string | null
  connected_at: string
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  disconnected: 'bg-gray-100 text-gray-600',
}

export default function ConnectionsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  async function loadAccounts() {
    setLoading(true)
    const res = await fetch('/api/connections')
    if (res.ok) {
      const data = await res.json() as ConnectedAccount[]
      setAccounts(data)
    }
    setLoading(false)
  }

  useEffect(() => { void loadAccounts() }, [])

  async function handleConnect() {
    if (!scriptLoaded) { setError('Widget ainda carregando, tente novamente.'); return }
    setConnecting(true)
    setError(null)
    try {
      const { accessToken } = await initiateConnection()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PluggyConnect = (window as any).PluggyConnect
      if (!PluggyConnect) { setError('Widget do Pluggy não carregou. Recarregue a página.'); return }

      const widget = new PluggyConnect({
        connectToken: accessToken,
        onSuccess: async (data: { item: { id: string; connector: { name: string } } }) => {
          const { id: itemId, connector: { name: institutionName } } = data.item
          const result = await saveConnection(itemId, institutionName)
          if (result.success) {
            await loadAccounts()
          } else {
            setError(result.error ?? 'Erro ao salvar conexão')
          }
        },
        onError: (err: { message: string }) => {
          setError(`Erro no widget: ${err.message}`)
        },
        onClose: () => {
          setConnecting(false)
        },
      })
      widget.init()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar conexão')
      setConnecting(false)
    }
  }

  async function handleDisconnect(accountId: string) {
    const result = await disconnectAccount(accountId)
    if (result.success) {
      await loadAccounts()
    } else {
      setError(result.error ?? 'Erro ao desconectar')
    }
  }

  return (
    <>
      <Script
        src="https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Contas conectadas</h2>
          <Button onClick={handleConnect} disabled={connecting || !scriptLoaded}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Conectar conta bancária
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Link2Off className="mx-auto h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma conta conectada ainda.</p>
              <p className="text-sm">Clique em &quot;Conectar conta bancária&quot; para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{account.institution_name}</CardTitle>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[account.status] ?? ''}`}>
                      {account.status === 'active' ? 'Ativa' : account.status === 'error' ? 'Erro' : 'Desconectada'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0">
                  <div className="text-sm text-muted-foreground">
                    {account.last_synced_at ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Última sincronização:{' '}
                        {new Date(account.last_synced_at).toLocaleDateString('pt-BR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span>Nunca sincronizado</span>
                    )}
                  </div>
                  {account.status !== 'disconnected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(account.id)}
                    >
                      Desconectar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
