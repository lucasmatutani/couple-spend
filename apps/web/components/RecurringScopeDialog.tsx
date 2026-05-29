'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  mode: 'edit' | 'delete'
  open: boolean
  onSingle: () => void
  onFuture: () => void
  onCancel: () => void
}

export default function RecurringScopeDialog({ mode, open, onSingle, onFuture, onCancel }: Props) {
  const isDelete = mode === 'delete'
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isDelete ? 'Excluir despesa recorrente' : 'Editar despesa recorrente'}
          </DialogTitle>
          <DialogDescription>
            Esta despesa faz parte de uma série recorrente. O que deseja{' '}
            {isDelete ? 'excluir' : 'editar'}?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          <Button variant="outline" className="justify-start h-auto py-3" onClick={onSingle}>
            <div className="text-left">
              <p className="font-medium">Somente este mês</p>
              <p className="text-xs text-muted-foreground">Os outros meses não serão afetados</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto py-3" onClick={onFuture}>
            <div className="text-left">
              <p className="font-medium">Este e todos os próximos</p>
              <p className="text-xs text-muted-foreground">
                Aplica a partir deste mês até o fim do ano
              </p>
            </div>
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
