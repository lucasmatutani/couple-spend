import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export interface CategoryDef {
  id: string
  name: string
}

export interface TransactionInput {
  externalId: string
  description: string
}

export interface LlmCategoryResult {
  categoryId: string
  confidence: number
}

const CATEGORY_HINTS: Record<string, string> = {
  Moradia: 'aluguel, condomínio, financiamento, IPTU, condo fee',
  Serviços: 'energia elétrica, água, gás, internet, telefone, CPFL, Vivo, Claro, Tim, NET',
  Mercado: 'supermercado, mercado, Carrefour, Pão de Açúcar, Atacadão, hortifruti',
  Transporte: 'Uber, 99, combustível, gasolina, estacionamento, pedágio, CPTM, metrô, taxi',
  Saúde: 'farmácia, drogaria, hospital, clínica, médico, dentista, laboratório, Droga Raia, Drogasil',
  Educação: 'escola, faculdade, curso, livro, Udemy, Coursera, mensalidade escolar',
  Assinaturas: 'Netflix, Spotify, Disney+, Amazon Prime, assinatura, iCloud, Adobe, software',
  Lazer: 'cinema, teatro, show, ingresso, jogo, Ticketmaster, Sympla',
  Roupas: 'roupa, calçado, Renner, C&A, Zara, H&M, loja de roupas, sapato, acessório',
  Restaurantes: 'restaurante, lanchonete, McDonald, iFood, Rappi, Ifood, cafeteria, bar, delivery de comida',
  Investimentos: 'aplicação, investimento, XP, BTG, corretora, CDB, tesouro',
  Reembolsos: 'estorno, reembolso, cashback, crédito, devolução',
  Outros: 'qualquer coisa que não se encaixa nas outras categorias',
}

const ResponseSchema = z.object({
  categorizations: z.array(
    z.object({
      externalId: z.string(),
      categoryId: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

/**
 * Batch-categorizes a list of transactions with a single Haiku call.
 * Returns a Map keyed by externalId. Entries missing from the map should
 * fall back to the chain resolver result.
 */
export async function batchCategorize(
  transactions: TransactionInput[],
  categories: CategoryDef[],
  client: Anthropic,
): Promise<Map<string, LlmCategoryResult>> {
  if (transactions.length === 0) return new Map()

  const categoryList = categories
    .map((c) => {
      const hint = CATEGORY_HINTS[c.name] ?? c.name.toLowerCase()
      return `- ${c.name} (id: ${c.id}): ${hint}`
    })
    .join('\n')

  const transactionList = JSON.stringify(
    transactions.map((t) => ({ externalId: t.externalId, description: t.description })),
  )

  const CATEGORIZATION_SYSTEM_PROMPT = `
You are a financial transaction categorizer for Brazilian bank and credit card statements.
Assign the most appropriate category to each transaction based on its description.
Return ONLY valid JSON, no markdown, no explanation:
{"categorizations":[{"externalId":"...","categoryId":"uuid","confidence":0.0}]}

Confidence guide: 0.9+ = very sure, 0.7–0.9 = fairly sure, 0.5–0.7 = uncertain.
If no category fits well, use the "Outros" category with low confidence.
Every externalId from the input must appear exactly once in the output.

USING BANK CATEGORIES:
Some transactions include a "bankCategory" field — a category label assigned by the bank itself.
When "bankCategory" is present and non-null, treat it as a strong signal and use the mapping below.
Only override it if the description clearly contradicts it (e.g. bankCategory is "ALIMENTAÇÃO" but description is "NETFLIX").

Bank category mapping:
  ALIMENTAÇÃO          → prefer "Dining out" for restaurant names (IFD*, ZIG*, RAPPI*, etc), "Groceries" for supermarkets (MERCADO, EXTRA, CARREFOUR)
  VEÍCULOS             → Transport
  SAÚDE                → Health
  VESTUÁRIO            → Clothing
  TURISMO E ENTRETENIM → check description: streaming services → Subscriptions, bars/events → Entertainment
  EDUCAÇÃO             → Education
  DIVERSOS             → Other (use low confidence 0.5, do not force a specific category)

When "bankCategory" is null (e.g. Nubank statements), categorize based on description alone using your knowledge of common Brazilian merchants.
`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: CATEGORIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Available categories:\n${categoryList}\n\nTransactions to categorize:\n${transactionList}\n\nCategorize all transactions.`,
      },
    ],
  });

  const textBlock = message.content.find((c): c is Anthropic.TextBlock => c.type === 'text')
  if (!textBlock) throw new Error('LLM categorizer returned no text content.')

  let parsed: unknown
  try {
    parsed = JSON.parse(textBlock.text.replace(/^```json\n?|\n?```$/g, '').trim())
  } catch {
    throw new Error(`LLM categorizer returned invalid JSON: ${textBlock.text.slice(0, 100)}`)
  }

  const result = ResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`LLM categorizer response schema invalid: ${result.error.message}`)
  }

  // Build a Set of valid category IDs for quick validation
  const validIds = new Set(categories.map((c) => c.id))

  const map = new Map<string, LlmCategoryResult>()
  for (const item of result.data.categorizations) {
    if (!validIds.has(item.categoryId)) continue // ignore hallucinated IDs
    map.set(item.externalId, { categoryId: item.categoryId, confidence: item.confidence })
  }
  return map
}
