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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cells: {
        Row: {
          country: string
          created_at: string
          goal: string | null
          id: string
          name: string
          segment: Database["public"]["Enums"]["segment_type"]
        }
        Insert: {
          country: string
          created_at?: string
          goal?: string | null
          id?: string
          name: string
          segment: Database["public"]["Enums"]["segment_type"]
        }
        Update: {
          country?: string
          created_at?: string
          goal?: string | null
          id?: string
          name?: string
          segment?: Database["public"]["Enums"]["segment_type"]
        }
        Relationships: []
      }
      levels: {
        Row: {
          color: string | null
          icon: string | null
          id: string
          max_xp: number
          min_xp: number
          name: string
          order_index: number
        }
        Insert: {
          color?: string | null
          icon?: string | null
          id?: string
          max_xp: number
          min_xp: number
          name: string
          order_index?: number
        }
        Update: {
          color?: string | null
          icon?: string | null
          id?: string
          max_xp?: number
          min_xp?: number
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      manager_cells: {
        Row: {
          assigned_at: string | null
          cell_id: string
          id: string
          manager_id: string
        }
        Insert: {
          assigned_at?: string | null
          cell_id: string
          id?: string
          manager_id: string
        }
        Update: {
          assigned_at?: string | null
          cell_id?: string
          id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_cells_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_cells_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_cells_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
      medals: {
        Row: {
          active: boolean | null
          category: string
          condition_type: string
          condition_value: number
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          xp_reward: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          condition_type: string
          condition_value: number
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          xp_reward?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          xp_value: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          xp_value?: number
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          xp_value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          cell_id: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          level_id: string | null
          manager_id: string | null
          name: string
          nickname: string | null
          shields: number | null
          streak: number | null
          updated_at: string
          xp: number | null
        }
        Insert: {
          avatar?: string | null
          cell_id?: string | null
          country?: string | null
          created_at?: string
          email: string
          id: string
          level_id?: string | null
          manager_id?: string | null
          name: string
          nickname?: string | null
          shields?: number | null
          streak?: number | null
          updated_at?: string
          xp?: number | null
        }
        Update: {
          avatar?: string | null
          cell_id?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          level_id?: string | null
          manager_id?: string | null
          name?: string
          nickname?: string | null
          shields?: number | null
          streak?: number | null
          updated_at?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          client_name: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          registered_by: string | null
          user_id: string
          xp_earned: number
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          registered_by?: string | null
          user_id: string
          xp_earned?: number
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          registered_by?: string | null
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_uploads: {
        Row: {
          created_at: string
          errors: Json | null
          failed_rows: number
          file_name: string
          id: string
          successful_rows: number
          total_rows: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          file_name: string
          id?: string
          successful_rows?: number
          total_rows?: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          file_name?: string
          id?: string
          successful_rows?: number
          total_rows?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medals: {
        Row: {
          earned_at: string
          id: string
          medal_id: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          medal_id: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          medal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medals_medal_id_fkey"
            columns: ["medal_id"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ranking_view: {
        Row: {
          avatar: string | null
          cell_id: string | null
          cell_name: string | null
          cell_rank: number | null
          country: string | null
          country_rank: number | null
          global_rank: number | null
          id: string | null
          manager_id: string | null
          name: string | null
          nickname: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          segment: Database["public"]["Enums"]["segment_type"] | null
          segment_rank: number | null
          xp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ranking_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMINISTRADOR" | "GERENTE" | "EJECUTIVO"
      segment_type: "Empresarios" | "Aliados" | "B&M" | "Despachos"
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
      app_role: ["ADMINISTRADOR", "GERENTE", "EJECUTIVO"],
      segment_type: ["Empresarios", "Aliados", "B&M", "Despachos"],
    },
  },
} as const
