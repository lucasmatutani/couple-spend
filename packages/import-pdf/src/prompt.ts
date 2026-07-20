export interface CategoryDef {
  id: string
  name: string
  keywordsHint?: string | null
}

const CATEGORY_HINTS: Record<string, string> = {
  Moradia: 'aluguel, condomínio, financiamento, IPTU',
  Serviços: 'energia elétrica, água, gás, internet, telefone, CPFL, Vivo, Claro, Tim',
  Mercado: 'supermercado, mercado, Carrefour, Pão de Açúcar, Atacadão, hortifruti',
  Alimentação: 'padaria, açougue, feira, hortifruti, lanchonete rápida, food truck',
  Transporte: 'Uber, 99, combustível, gasolina, estacionamento, pedágio, metrô, taxi',
  Saúde: 'farmácia, drogaria, hospital, clínica, médico, dentista, Droga Raia, Drogasil',
  Educação: 'escola, faculdade, curso, livro, Udemy, Coursera, mensalidade',
  Assinaturas: 'Netflix, Spotify, Disney+, Amazon Prime, iCloud, Adobe, assinatura mensal',
  Lazer: 'cinema, teatro, show, ingresso, Ticketmaster, Sympla',
  Roupas: 'roupa, calçado, Renner, C&A, Zara, H&M, sapato, acessório',
  Restaurantes: 'restaurante, lanchonete, McDonald, iFood, Rappi, cafeteria, bar, delivery',
  Reembolsos: 'estorno, reembolso, cashback, crédito, devolução',
  Outros: 'qualquer coisa que não se encaixa nas demais categorias',
}

const BANK_CATEGORY_MAPPING = `
Bank category → app category hints:
  ALIMENTAÇÃO          → Restaurantes for IFD*, ZIG*, RAPPI*, food apps; Mercado for MERCADO, EXTRA, CARREFOUR
  VEÍCULOS             → Transporte
  SAÚDE                → Saúde
  VESTUÁRIO            → Roupas
  TURISMO E ENTRETENIM → Assinaturas for streaming; Lazer for bars/events
  EDUCAÇÃO             → Educação
  DIVERSOS             → Outros (confidence ≤ 0.5)`

function buildKeywordMatchSection(
  title: string,
  keywords: string[],
  keywordMeaning: string,
  fieldName: string,
): string {
  if (keywords.length === 0) return ''

  const keywordList = keywords.map((k) => `  - "${k}"`).join('\n')

  return `

──── ${title} ────

The user has registered these keywords as ${keywordMeaning}:
${keywordList}

For each transaction, set "${fieldName}": true if its description matches one of these
keywords — match loosely (case-insensitive, partial, ignoring merchant suffixes/codes
like ".COM", store numbers, or city names). Otherwise set "${fieldName}": false.`
}

export function buildUnifiedPrompt(
  categories: CategoryDef[],
  sharedBillKeywords: string[] = [],
  fullRefundKeywords: string[] = [],
): string {
  const categoryList = categories
    .map((c) => {
      // Household-defined hint takes priority — the user knows their own merchants
      // better than the hardcoded hints below, which only cover the global templates.
      const hint = c.keywordsHint?.trim() || CATEGORY_HINTS[c.name] || c.name.toLowerCase()
      return `  - "${c.name}" (id: ${c.id}): ${hint}`
    })
    .join('\n')

  return `You are a financial transaction extractor and categorizer for Brazilian bank and credit card statements.
Extract all transactions from the PDF and assign the best matching category to each one.
Return ONLY valid JSON — no markdown, no explanation.

──── EXTRACTION RULES ────

- "amountCents": positive integer in cents. R$ 1.234,56 → 123456. Always positive regardless of type.
- "type": "expense" for purchases, fees, and taxes. "income" ONLY for genuine refunds or chargebacks (negative values shown with minus sign next to a merchant name). Do NOT classify bill payments as income.
- "occurredAt": "YYYY-MM-DD" using the transaction date, not posting date. For fee lines without a date (e.g. "Repasse de IOF"), use the statement closing date.
- "description": raw text exactly as shown in the document. Do not normalize or translate.
- "installment": if description contains a fraction like "02/10" or "3/12", return { "current": 2, "total": 10 }. Otherwise null.
- "warnings": list any extraction issues (illegible text, ambiguous dates, etc.) IN BRAZILIAN PORTUGUESE.

INCLUDE: all purchases and charges in the current billing period, fees ("Repasse de IOF", "Anuidade", "Taxa de câmbio"), genuine refunds.
EXCLUDE: bill payments ("Pagamento em DD MMM", "Pagamento efetuado em"), balance carry-overs ("Saldo restante da fatura anterior"), future installments ("Compras parceladas - próximas faturas"), zero-value lines.

──── CATEGORIZATION RULES ────

Assign the most appropriate category from the list below to each transaction.
- "confidence": 0.9+ very sure · 0.7–0.9 fairly sure · 0.5–0.7 uncertain · <0.5 use Outros
- When the document shows a bank category label next to the transaction, use it as a strong signal:
${BANK_CATEGORY_MAPPING}
- When no bank category is shown, categorize from description using your knowledge of Brazilian merchants.
- Every transaction must have a "categoryId" (use the exact id string from the list).

Available categories:
${categoryList}
${buildKeywordMatchSection(
  'RECURRING SHARED-BILL DETECTION',
  sharedBillKeywords,
  'recurring bills that always appear on their invoice and are always split with their partner (rent, utilities, subscriptions, etc.)',
  'isSharedBill',
)}
${buildKeywordMatchSection(
  'FULL-REFUND BILL DETECTION',
  fullRefundKeywords,
  'bills they pay in full on this card but are always fully reimbursed for by a third party (employer, health plan, etc.) — the transaction costs them R$0',
  'isFullyReimbursed',
)}

──── OUTPUT SCHEMA ────

{
  "institution": "string",
  "statementPeriod": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "transactions": [
    {
      "occurredAt": "YYYY-MM-DD",
      "description": "string",
      "amountCents": number,
      "type": "expense" | "income",
      "installment": { "current": number, "total": number } | null,
      "categoryId": "exact id from the list above",
      "confidence": number${sharedBillKeywords.length > 0 ? ',\n      "isSharedBill": boolean' : ''}${fullRefundKeywords.length > 0 ? ',\n      "isFullyReimbursed": boolean' : ''}
    }
  ],
  "warnings": ["string"]
}`
}
