export const BUCKET_OPTIONS = [
  { value: 'needs', label: 'Necessidades' },
  { value: 'wants', label: 'Desejos' },
  { value: 'savings', label: 'Investimentos/Poupança' },
]

export const SPLIT_OPTIONS = [
  { value: 'EQUAL', label: 'Dividir igualmente' },
  { value: 'ONLY_PAYER', label: 'Só quem pagou' },
  { value: 'ONLY_OTHER', label: 'Só o outro membro' },
  { value: 'CUSTOM', label: 'Percentual customizado' },
]

export const BUCKET_LABELS: Record<string, string> = Object.fromEntries(
  BUCKET_OPTIONS.map((o) => [o.value, o.label]),
)

export const SPLIT_LABELS: Record<string, string> = Object.fromEntries(
  SPLIT_OPTIONS.map((o) => [o.value, o.label]),
)
