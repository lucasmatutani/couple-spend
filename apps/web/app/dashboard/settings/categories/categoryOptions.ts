export const SPLIT_OPTIONS = [
  { value: 'EQUAL', label: 'Dividir igualmente' },
  { value: 'ONLY_PAYER', label: 'Só quem pagou' },
  { value: 'ONLY_OTHER', label: 'Só o outro membro' },
  { value: 'CUSTOM', label: 'Percentual customizado' },
]

export const SPLIT_LABELS: Record<string, string> = Object.fromEntries(
  SPLIT_OPTIONS.map((o) => [o.value, o.label]),
)
