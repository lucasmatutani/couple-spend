import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGoalRepository, getIndividualBudgetUseCase, getEvaluateGoalsUseCase } from '@/lib/container'
import { YearMonth, toUserId } from '@splitwise/domain'
import type { GoalType } from '@splitwise/domain'
import { addGoal, deleteGoal } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const GOAL_LABELS: Record<GoalType, string> = {
  MIN_SAVINGS: 'Meta — investimentos',
  MIN_SURPLUS: 'Meta — sobra',
}

const STATUS_BADGE: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  at_risk: 'bg-amber-100 text-amber-800',
  exceeded: 'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<string, string> = {
  on_track: 'No alvo',
  at_risk: 'Em risco',
  exceeded: 'Excedido',
}

export default async function GoalsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userId = toUserId(user.id)
  const month = YearMonth.current()

  const [goals, budget] = await Promise.all([
    getGoalRepository().findByOwner(userId),
    getIndividualBudgetUseCase().execute(userId, month),
  ])

  const activeGoals = goals.filter(
    (g) => g.appliesToMonth === null || g.appliesToMonth.toString() === month.toString(),
  )
  const evaluations = getEvaluateGoalsUseCase().execute(budget, activeGoals)
  const evalMap = new Map(evaluations.map((e) => [e.goal.id as string, e]))

  async function handleAdd(formData: FormData) {
    'use server'
    await addGoal({
      goalType: formData.get('goalType'),
      targetPercent: formData.get('targetPercent'),
      appliesToMonth: (formData.get('appliesToMonth') as string | null) || undefined,
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Metas de orçamento</h2>

      {goals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas ({month.toString()})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.map((goal) => {
              const ev = evalMap.get(goal.id as string)
              const deleteAction = deleteGoal.bind(null, goal.id as string)
              return (
                <div
                  key={goal.id as string}
                  className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{GOAL_LABELS[goal.goalType]}</p>
                    <p className="text-xs text-muted-foreground">
                      Mín: {goal.targetPercent}%
                      {goal.appliesToMonth
                        ? ` · ${goal.appliesToMonth.toString()}`
                        : ' · recorrente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ev && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ev.status] ?? ''}`}
                      >
                        {STATUS_LABEL[ev.status] ?? ev.status} ({Math.round(ev.actual * 100)}%)
                      </span>
                    )}
                    <form action={deleteAction}>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="submit"
                        className="text-destructive hover:text-destructive"
                      >
                        Excluir
                      </Button>
                    </form>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">Nenhuma meta definida ainda.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar meta</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goalType">Tipo de meta</Label>
              <select
                id="goalType"
                name="goalType"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(Object.entries(GOAL_LABELS) as [GoalType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPercent">Meta (%): 0–100</Label>
              <Input
                id="targetPercent"
                name="targetPercent"
                type="number"
                min={0}
                max={100}
                defaultValue={30}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appliesToMonth">Mês específico (opcional — deixe vazio para recorrente)</Label>
              <Input id="appliesToMonth" name="appliesToMonth" type="month" />
            </div>

            <Button type="submit" className="w-full">
              Adicionar meta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
