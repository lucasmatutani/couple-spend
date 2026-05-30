import type { CategoryResolution, RawTransaction } from '@splitwise/import-core'
import type { CategoryResolverChainLink } from './CategoryResolverChainLink.js'

export type CategoryRule = {
  /** Regex source string (no surrounding slashes). Matched case-insensitively. */
  pattern: string
  /** Category ID or name placeholder — resolved to a UUID by the factory in resolvers.ts. */
  categoryId: string
  /** Higher priority rules are tested first. */
  priority: number
}

/**
 * Default rules map to global template category names (SPEC §15.1).
 * The `categoryId` fields are category names used as placeholders;
 * buildCategoryResolver() in apps/web/lib/resolvers.ts resolves them to UUIDs.
 */
export const DEFAULT_RULES: CategoryRule[] = [
  { pattern: 'posto|shell|petrobras|ipiranga|combustivel', categoryId: 'Transporte', priority: 100 },
  { pattern: 'uber|99taxi|cabify|metro sp|onibus|metrô', categoryId: 'Transporte', priority: 99 },
  { pattern: 'supermercado|mercado|extra|carrefour|pao de acucar|hortifruti', categoryId: 'Mercado', priority: 98 },
  { pattern: 'escola|colegio|faculdade|universidade|mensalidade', categoryId: 'Educação', priority: 97 },
  { pattern: 'farmacia|drogaria|ultrafarma|droga raia|pacheco', categoryId: 'Saúde', priority: 96 },
  { pattern: 'netflix|spotify|amazon prime|disney|hbo|globoplay|deezer', categoryId: 'Assinaturas', priority: 95 },
  { pattern: 'restaurante|lanchonete|mcdonalds|ifood|rappi|burger king', categoryId: 'Restaurantes', priority: 94 },
  { pattern: 'aluguel|condominio', categoryId: 'Moradia', priority: 93 },
  { pattern: 'energia|enel|cpfl|cemig|light|elektro', categoryId: 'Serviços', priority: 92 },
  { pattern: 'internet|claro|vivo|tim\\b|oi\\b|net combo', categoryId: 'Serviços', priority: 91 },
]

export class RuleBasedResolver implements CategoryResolverChainLink {
  private readonly sorted: CategoryRule[]

  constructor(rules: CategoryRule[]) {
    this.sorted = [...rules].sort((a, b) => b.priority - a.priority)
  }

  async resolve(raw: RawTransaction): Promise<CategoryResolution | null> {
    for (const rule of this.sorted) {
      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(raw.description)) {
        return { categoryId: rule.categoryId, confidence: 1.0, source: 'rule' }
      }
    }
    return null
  }
}
