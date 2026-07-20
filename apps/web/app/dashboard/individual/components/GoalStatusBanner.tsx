import type { GoalEvaluation, GoalType } from '@splitwise/domain'
import { Money } from '@splitwise/domain'

const GOAL_LABELS: Record<GoalType, string> = {
  MIN_SAVINGS: 'Meta de investimentos',
  MIN_SURPLUS: 'Meta de sobra',
}

type Props = {
  evaluations: GoalEvaluation[]
  totalIncomeCents: number
}

export default function GoalStatusBanner({ evaluations, totalIncomeCents }: Props) {
  const alerts = evaluations.filter((e) => e.status !== 'on_track')
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((ev) => {
        const label = GOAL_LABELS[ev.goal.goalType]
        const actualPct = Math.round(ev.actual * 100)
        const targetPct = Math.round(ev.target * 100)
        const diffCents = Math.round(Math.abs(ev.actual - ev.target) * totalIncomeCents)

        if (ev.status === 'at_risk') {
          return (
            <div
              key={ev.goal.id as string}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              ⚠ {label} está em {actualPct}% — próximo do limite de {targetPct}%
            </div>
          )
        }

        return (
          <div
            key={ev.goal.id as string}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            ✕ {label} — meta de {targetPct}% não atingida em{' '}
            {Money.of(diffCents).format()}
          </div>
        )
      })}
    </div>
  )
}
