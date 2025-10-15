export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      fx_rates: {
        Row: {
          asof: string
          base_currency: string
          created_at: string
          id: string
          quote_currency: string
          rate: number
        }
        Insert: {
          asof: string
          base_currency: string
          created_at?: string
          id?: string
          quote_currency: string
          rate: number
        }
        Update: {
          asof?: string
          base_currency?: string
          created_at?: string
          id?: string
          quote_currency?: string
          rate?: number
        }
        Relationships: []
      }
      lots: {
        Row: {
          created_at: string
          id: string
          opened_at: string
          original_transaction_id: string | null
          owner_id: string
          portfolio_id: string
          quantity_open: number
          symbol_id: string
          unit_cost_base: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_at: string
          original_transaction_id?: string | null
          owner_id: string
          portfolio_id: string
          quantity_open?: number
          symbol_id: string
          unit_cost_base: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_at?: string
          original_transaction_id?: string | null
          owner_id?: string
          portfolio_id?: string
          quantity_open?: number
          symbol_id?: string
          unit_cost_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      historical_price_cache: {
        Row: {
          created_at: string
          date: string
          price: number
          price_currency: string
          symbol_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          price: number
          price_currency?: string
          symbol_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          price?: number
          price_currency?: string
          symbol_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_price_cache_symbol_id_fkey",
            columns: ["symbol_id"],
            isOneToOne: false,
            referencedRelation: "symbols",
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          asof: string
          change_24h: number | null
          change_percent_24h: number | null
          created_at: string
          id: string
          price: number
          price_currency: string
          symbol_id: string
        }
        Insert: {
          asof?: string
          change_24h?: number | null
          change_percent_24h?: number | null
          created_at?: string
          id?: string
          price: number
          price_currency: string
          symbol_id: string
        }
        Update: {
          asof?: string
          change_24h?: number | null
          change_percent_24h?: number | null
          created_at?: string
          id?: string
          price?: number
          price_currency?: string
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_cache_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: true
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          default_lot_method: Database["public"]["Enums"]["lot_method"]
          id: string
          market_data_provider: 'alphavantage' | 'yfinance' | 'finnhub'
          owner_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          default_lot_method?: Database["public"]["Enums"]["lot_method"]
          id?: string
          market_data_provider?: 'alphavantage' | 'yfinance' | 'finnhub'
          owner_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          default_lot_method?: Database["public"]["Enums"]["lot_method"]
          id?: string
          market_data_provider?: 'alphavantage' | 'yfinance' | 'finnhub'
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      symbols: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          exchange: string | null
          id: string
          name: string | null
          owner_id: string
          quote_currency: string
          ticker: string
          updated_at: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          exchange?: string | null
          id?: string
          name?: string | null
          owner_id: string
          quote_currency?: string
          ticker: string
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          exchange?: string | null
          id?: string
          name?: string | null
          owner_id?: string
          quote_currency?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          fee: number
          fx_rate: number
          id: string
          lot_link: string | null
          notes: string | null
          owner_id: string
          portfolio_id: string
          quantity: number
          symbol_id: string | null
          trade_currency: string
          trade_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee?: number
          fx_rate?: number
          id?: string
          lot_link?: string | null
          notes?: string | null
          owner_id: string
          portfolio_id: string
          quantity?: number
          symbol_id?: string | null
          trade_currency?: string
          trade_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee?: number
          fx_rate?: number
          id?: string
          lot_link?: string | null
          notes?: string | null
          owner_id?: string
          portfolio_id?: string
          quantity?: number
          symbol_id?: string | null
          trade_currency?: string
          trade_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          symbol_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          symbol_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upsert_historical_price_cache: {
        Args: {
          p_symbol_id: string
          p_points: Json
        }
        Returns: number
      }
      upsert_price_cache_entry: {
        Args: {
          p_symbol_id: string
          p_price: number
          p_price_currency?: string
          p_change_24h?: number | null
          p_change_percent_24h?: number | null
          p_asof?: string
        }
        Returns: null
      }
    }
    Enums: {
      asset_type: "EQUITY" | "ETF" | "CRYPTO" | "FUND"
      lot_method: "FIFO" | "LIFO" | "HIFO" | "AVERAGE"
      transaction_type:
        | "BUY"
        | "SELL"
        | "DEPOSIT"
        | "WITHDRAW"
        | "TRANSFER"
        | "DIVIDEND"
        | "FEE"
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
  public: {
    Enums: {
      asset_type: ["EQUITY", "ETF", "CRYPTO", "FUND"],
      lot_method: ["FIFO", "LIFO", "HIFO", "AVERAGE"],
      transaction_type: [
        "BUY",
        "SELL",
        "DEPOSIT",
        "WITHDRAW",
        "TRANSFER",
        "DIVIDEND",
        "FEE",
      ],
    },
  },
} as const
