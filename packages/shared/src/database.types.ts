export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          default_split_rule: Database["public"]["Enums"]["split_rule_type"]
          household_id: string | null
          id: string
          is_template: boolean
          keywords_hint: string | null
          name: string
          parent_id: string | null
        }
        Insert: {
          default_split_rule?: Database["public"]["Enums"]["split_rule_type"]
          household_id?: string | null
          id?: string
          is_template?: boolean
          keywords_hint?: string | null
          name: string
          parent_id?: string | null
        }
        Update: {
          default_split_rule?: Database["public"]["Enums"]["split_rule_type"]
          household_id?: string | null
          id?: string
          is_template?: boolean
          keywords_hint?: string | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_memory: {
        Row: {
          category_id: string
          confidence: number
          description_pattern: string
          household_id: string
          id: string
          owner_id: string
        }
        Insert: {
          category_id: string
          confidence?: number
          description_pattern: string
          household_id: string
          id?: string
          owner_id: string
        }
        Update: {
          category_id?: string
          confidence?: number
          description_pattern?: string
          household_id?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_memory_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_memory_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_memory_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connected_at: string
          id: string
          institution_name: string
          last_synced_at: string | null
          owner_id: string
          provider: string
          provider_item_id: string
          status: string
        }
        Insert: {
          connected_at?: string
          id?: string
          institution_name: string
          last_synced_at?: string | null
          owner_id: string
          provider: string
          provider_item_id: string
          status?: string
        }
        Update: {
          connected_at?: string
          id?: string
          institution_name?: string
          last_synced_at?: string | null
          owner_id?: string
          provider?: string
          provider_item_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category_id: string
          description: string | null
          external_id: string
          household_id: string
          id: string
          imported_at: string
          is_recurring: boolean
          occurred_at: string
          paid_by: string
          recurring_expense_id: string | null
          source_id: string
          split_rule_payer_percent: number | null
          split_rule_type: Database["public"]["Enums"]["split_rule_type"]
        }
        Insert: {
          amount_cents: number
          category_id: string
          description?: string | null
          external_id?: string
          household_id: string
          id?: string
          imported_at?: string
          is_recurring?: boolean
          occurred_at: string
          paid_by: string
          recurring_expense_id?: string | null
          source_id?: string
          split_rule_payer_percent?: number | null
          split_rule_type: Database["public"]["Enums"]["split_rule_type"]
        }
        Update: {
          amount_cents?: number
          category_id?: string
          description?: string | null
          external_id?: string
          household_id?: string
          id?: string
          imported_at?: string
          is_recurring?: boolean
          occurred_at?: string
          paid_by?: string
          recurring_expense_id?: string | null
          source_id?: string
          split_rule_payer_percent?: number | null
          split_rule_type?: Database["public"]["Enums"]["split_rule_type"]
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          applies_to_month: string | null
          created_at: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          owner_id: string
          target_percent: number
        }
        Insert: {
          applies_to_month?: string | null
          created_at?: string
          goal_type: Database["public"]["Enums"]["goal_type"]
          id?: string
          owner_id: string
          target_percent: number
        }
        Update: {
          applies_to_month?: string | null
          created_at?: string
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          owner_id?: string
          target_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          occurred_at: string
          owner_id: string
          recurring: boolean
          recurring_income_id: string | null
          source: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          occurred_at: string
          owner_id: string
          recurring?: boolean
          recurring_income_id?: string | null
          source: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          occurred_at?: string
          owner_id?: string
          recurring?: boolean
          recurring_income_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_recurring_income_id_fkey"
            columns: ["recurring_income_id"]
            isOneToOne: false
            referencedRelation: "recurring_incomes"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount_cents: number
          asset_class: string
          created_at: string
          description: string | null
          id: string
          occurred_at: string
          owner_id: string
        }
        Insert: {
          amount_cents: number
          asset_class: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at: string
          owner_id: string
        }
        Update: {
          amount_cents?: number
          asset_class?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_expenses: {
        Row: {
          amount_cents: number
          category_id: string
          description: string | null
          external_id: string
          id: string
          imported_at: string
          occurred_at: string
          owner_id: string
          payment_method: string | null
          recurring_personal_expense_id: string | null
          reimbursed: boolean
          source_id: string
          split_parts: number
          split_with_partner: boolean
        }
        Insert: {
          amount_cents: number
          category_id: string
          description?: string | null
          external_id?: string
          id?: string
          imported_at?: string
          occurred_at: string
          owner_id: string
          payment_method?: string | null
          recurring_personal_expense_id?: string | null
          reimbursed?: boolean
          source_id?: string
          split_parts?: number
          split_with_partner?: boolean
        }
        Update: {
          amount_cents?: number
          category_id?: string
          description?: string | null
          external_id?: string
          id?: string
          imported_at?: string
          occurred_at?: string
          owner_id?: string
          payment_method?: string | null
          recurring_personal_expense_id?: string | null
          reimbursed?: boolean
          source_id?: string
          split_parts?: number
          split_with_partner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "personal_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_expenses_recurring_personal_expense_id_fkey"
            columns: ["recurring_personal_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_personal_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          active: boolean
          amount_cents: number
          category_id: string
          created_at: string
          description: string
          household_id: string
          id: string
          installment_count: number | null
          paid_by: string
          split_rule_payer_percent: number | null
          split_rule_type: Database["public"]["Enums"]["split_rule_type"]
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category_id: string
          created_at?: string
          description: string
          household_id: string
          id?: string
          installment_count?: number | null
          paid_by: string
          split_rule_payer_percent?: number | null
          split_rule_type: Database["public"]["Enums"]["split_rule_type"]
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category_id?: string
          created_at?: string
          description?: string
          household_id?: string
          id?: string
          installment_count?: number | null
          paid_by?: string
          split_rule_payer_percent?: number | null
          split_rule_type?: Database["public"]["Enums"]["split_rule_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          id: string
          owner_id: string
          source: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          id?: string
          owner_id: string
          source: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          id?: string
          owner_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_incomes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_personal_expenses: {
        Row: {
          active: boolean
          amount_cents: number
          category_id: string
          created_at: string
          description: string
          id: string
          installment_count: number | null
          owner_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category_id: string
          created_at?: string
          description: string
          id?: string
          installment_count?: number | null
          owner_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          installment_count?: number | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_personal_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_personal_expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_bill_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          kind: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          kind?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          kind?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_bill_keywords_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      users: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          plan: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          plan?: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_household_ids: { Args: never; Returns: string[] }
      is_household_member: {
        Args: { p_household_id: string }
        Returns: boolean
      }
      is_household_owner: { Args: { p_household_id: string }; Returns: boolean }
    }
    Enums: {
      goal_type: "MIN_SAVINGS" | "MIN_SURPLUS"
      member_role: "owner" | "member"
      plan_type: "free" | "pro" | "family"
      split_rule_type: "EQUAL" | "ONLY_PAYER" | "ONLY_OTHER" | "CUSTOM"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      goal_type: ["MIN_SAVINGS", "MIN_SURPLUS"],
      member_role: ["owner", "member"],
      plan_type: ["free", "pro", "family"],
      split_rule_type: ["EQUAL", "ONLY_PAYER", "ONLY_OTHER", "CUSTOM"],
    },
  },
} as const

