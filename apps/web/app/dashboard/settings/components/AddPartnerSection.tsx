'use client'

import { useActionState } from 'react'
import { addPartnerByEmail, type AddPartnerState } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: AddPartnerState = { status: 'idle' }

export default function AddPartnerSection() {
  const [state, formAction, pending] = useActionState(addPartnerByEmail, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="partner-email">E-mail do parceiro</Label>
        <Input
          id="partner-email"
          name="email"
          type="email"
          placeholder="parceiro@email.com"
          required
          disabled={pending}
        />
      </div>
      {state.status === 'error' && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.status === 'success' && (
        <p className="text-sm text-green-600">
          Parceiro adicionado! Um e-mail com as credenciais foi enviado para{' '}
          <strong>{state.email}</strong>.
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Adicionando...' : 'Adicionar parceiro'}
      </Button>
    </form>
  )
}
