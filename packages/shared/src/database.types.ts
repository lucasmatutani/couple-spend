// Auto-generated shape — run `pnpm gen:types` after each migration to regenerate.
// Manually maintained until Supabase is running locally.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ── Enums ────────────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro' | 'family'
export type MemberRole = 'owner' | 'member'
export type SplitRuleType = 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM'
export type BudgetBucket = 'needs' | 'wants' | 'savings'
export type GoalType = 'MAX_NEEDS' | 'MAX_WANTS' | 'MIN_SAVINGS' | 'MIN_SURPLUS'

// ── Database ─────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          email: string
          plan: PlanType
          stripe_customer_id: string | null
          trial_ends_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          email: string
          plan?: PlanType
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          email?: string
          plan?: PlanType
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'households_created_by_fkey'; columns: ['created_by']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }
      household_members: {
        Row: {
          household_id: string
          user_id: string
          role: MemberRole
          joined_at: string
        }
        Insert: {
          household_id: string
          user_id: string
          role?: MemberRole
          joined_at?: string
        }
        Update: {
          household_id?: string
          user_id?: string
          role?: MemberRole
          joined_at?: string
        }
        Relationships: [
          { foreignKeyName: 'household_members_household_id_fkey'; columns: ['household_id']; referencedRelation: 'households'; referencedColumns: ['id'] },
          { foreignKeyName: 'household_members_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }
      categories: {
        Row: {
          id: string
          household_id: string | null
          parent_id: string | null
          name: string
          budget_bucket: BudgetBucket
          default_split_rule: SplitRuleType
          is_template: boolean
        }
        Insert: {
          id?: string
          household_id?: string | null
          parent_id?: string | null
          name: string
          budget_bucket: BudgetBucket
          default_split_rule?: SplitRuleType
          is_template?: boolean
        }
        Update: {
          id?: string
          household_id?: string | null
          parent_id?: string | null
          name?: string
          budget_bucket?: BudgetBucket
          default_split_rule?: SplitRuleType
          is_template?: boolean
        }
        Relationships: [
          { foreignKeyName: 'categories_household_id_fkey'; columns: ['household_id']; referencedRelation: 'households'; referencedColumns: ['id'] }
        ]
      }
      expenses: {
        Row: {
          id: string
          household_id: string
          paid_by: string
          category_id: string
          occurred_at: string
          amount_cents: number
          description: string | null
          split_rule_type: SplitRuleType
          split_rule_payer_percent: number | null
          source_id: string
          external_id: string
          imported_at: string
          recurring_expense_id: string | null
        }
        Insert: {
          id?: string
          household_id: string
          paid_by: string
          category_id: string
          occurred_at: string
          amount_cents: number
          description?: string | null
          split_rule_type: SplitRuleType
          split_rule_payer_percent?: number | null
          source_id?: string
          external_id?: string
          imported_at?: string
          recurring_expense_id?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          paid_by?: string
          category_id?: string
          occurred_at?: string
          amount_cents?: number
          description?: string | null
          split_rule_type?: SplitRuleType
          split_rule_payer_percent?: number | null
          source_id?: string
          external_id?: string
          imported_at?: string
          recurring_expense_id?: string | null
        }
        Relationships: [
          { foreignKeyName: 'expenses_household_id_fkey'; columns: ['household_id']; referencedRelation: 'households'; referencedColumns: ['id'] },
          { foreignKeyName: 'expenses_paid_by_fkey'; columns: ['paid_by']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'expenses_category_id_fkey'; columns: ['category_id']; referencedRelation: 'categories'; referencedColumns: ['id'] }
        ]
      }
      personal_expenses: {
        Row: {
          id: string
          owner_id: string
          category_id: string
          occurred_at: string
          amount_cents: number
          description: string | null
          source_id: string
          external_id: string
          imported_at: string
          recurring_personal_expense_id: string | null
          payment_method: string | null
          split_parts: number
        }
        Insert: {
          id?: string
          owner_id: string
          category_id: string
          occurred_at: string
          amount_cents: number
          description?: string | null
          source_id?: string
          external_id?: string
          imported_at?: string
          recurring_personal_expense_id?: string | null
          payment_method?: string | null
          split_parts?: number
        }
        Update: {
          id?: string
          owner_id?: string
          category_id?: string
          occurred_at?: string
          amount_cents?: number
          description?: string | null
          source_id?: string
          external_id?: string
          imported_at?: string
          recurring_personal_expense_id?: string | null
          payment_method?: string | null
          split_parts?: number
        }
        Relationships: []
      }
      recurring_incomes: {
        Row: {
          id: string
          owner_id: string
          source: string
          amount_cents: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          source: string
          amount_cents: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          source?: string
          amount_cents?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          id: string
          owner_id: string
          occurred_at: string
          amount_cents: number
          source: string
          recurring: boolean
          recurring_income_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          occurred_at: string
          amount_cents: number
          source: string
          recurring?: boolean
          recurring_income_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          occurred_at?: string
          amount_cents?: number
          source?: string
          recurring?: boolean
          recurring_income_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          id: string
          owner_id: string
          occurred_at: string
          amount_cents: number
          asset_class: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          occurred_at: string
          amount_cents: number
          asset_class: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          occurred_at?: string
          amount_cents?: number
          asset_class?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      category_memory: {
        Row: {
          id: string
          household_id: string
          owner_id: string
          description_pattern: string
          category_id: string
          confidence: number
        }
        Insert: {
          id?: string
          household_id: string
          owner_id: string
          description_pattern: string
          category_id: string
          confidence?: number
        }
        Update: {
          id?: string
          household_id?: string
          owner_id?: string
          description_pattern?: string
          category_id?: string
          confidence?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          owner_id: string
          goal_type: GoalType
          target_percent: number
          applies_to_month: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          goal_type: GoalType
          target_percent: number
          applies_to_month?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          goal_type?: GoalType
          target_percent?: number
          applies_to_month?: string | null
          created_at?: string
        }
        Relationships: []
      }
      connected_accounts: {
        Row: {
          id: string
          owner_id: string
          provider: string
          provider_item_id: string
          institution_name: string
          connected_at: string
          last_synced_at: string | null
          status: string
        }
        Insert: {
          id?: string
          owner_id: string
          provider: string
          provider_item_id: string
          institution_name: string
          connected_at?: string
          last_synced_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          owner_id?: string
          provider?: string
          provider_item_id?: string
          institution_name?: string
          connected_at?: string
          last_synced_at?: string | null
          status?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          id: string
          household_id: string
          paid_by: string
          category_id: string
          amount_cents: number
          description: string
          split_rule_type: SplitRuleType
          split_rule_payer_percent: number | null
          installment_count: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          paid_by: string
          category_id: string
          amount_cents: number
          description: string
          split_rule_type: SplitRuleType
          split_rule_payer_percent?: number | null
          installment_count?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          paid_by?: string
          category_id?: string
          amount_cents?: number
          description?: string
          split_rule_type?: SplitRuleType
          split_rule_payer_percent?: number | null
          installment_count?: number | null
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      recurring_personal_expenses: {
        Row: {
          id: string
          owner_id: string
          category_id: string
          amount_cents: number
          description: string
          installment_count: number | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          category_id: string
          amount_cents: number
          description: string
          installment_count?: number | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          category_id?: string
          amount_cents?: number
          description?: string
          installment_count?: number | null
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_household_member: { Args: { p_household_id: string }; Returns: boolean }
      is_household_owner: { Args: { p_household_id: string }; Returns: boolean }
      get_my_household_ids: { Args: Record<string, never>; Returns: string[] }
    }
    Enums: {
      plan_type: PlanType
      member_role: MemberRole
      split_rule_type: SplitRuleType
      budget_bucket: BudgetBucket
      goal_type: GoalType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
