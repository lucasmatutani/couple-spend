import { cn } from '@/lib/utils'

interface MoneyProps {
  cents: number
  size?: 'sm' | 'md' | 'lg'
  showSign?: boolean
  colorize?: boolean
  className?: string
}

export function Money({ cents, size = 'md', showSign = false, colorize = false, className }: MoneyProps) {
  const value = cents / 100
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(value))

  const sign = cents < 0 ? '-' : showSign ? '+' : ''
  const display = `${sign}${formatted}`

  return (
    <span
      className={cn(
        size === 'lg' && 'money-lg',
        size === 'md' && 'money-md',
        size === 'sm' && 'money-sm',
        colorize && cents > 0 && 'text-positive',
        colorize && cents < 0 && 'text-negative',
        className,
      )}
    >
      {display}
    </span>
  )
}
