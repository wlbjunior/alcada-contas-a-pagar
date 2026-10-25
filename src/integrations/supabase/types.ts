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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aprovacoes: {
        Row: {
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          decidido_por_nome: string | null
          demanda_id: string
          id: string
          justificativa: string | null
          motivo: string | null
          prazo: string | null
          recomendacao_ia: string | null
          resume_url: string | null
          status: string
        }
        Insert: {
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decidido_por_nome?: string | null
          demanda_id: string
          id?: string
          justificativa?: string | null
          motivo?: string | null
          prazo?: string | null
          recomendacao_ia?: string | null
          resume_url?: string | null
          status?: string
        }
        Update: {
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decidido_por_nome?: string | null
          demanda_id?: string
          id?: string
          justificativa?: string | null
          motivo?: string | null
          prazo?: string | null
          recomendacao_ia?: string | null
          resume_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          codigo: string
          id: string
          nome: string
          orcamento_mensal: number
        }
        Insert: {
          codigo: string
          id?: string
          nome: string
          orcamento_mensal?: number
        }
        Update: {
          codigo?: string
          id?: string
          nome?: string
          orcamento_mensal?: number
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string | null
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao?: string | null
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string | null
          valor?: Json
        }
        Relationships: []
      }
      demandas: {
        Row: {
          atualizado_em: string
          canal: string
          categoria: string | null
          centro_custo_id: string | null
          checagens: Json
          cnpj: string | null
          codigo: string
          confianca: number | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          extracao: Json | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          motivos: string[]
          n8n_execution_id: string | null
          numero_documento: string | null
          prioridade: string | null
          recomendacao_ia: string | null
          remetente_email: string | null
          remetente_nome: string | null
          rota: string | null
          status: Database["public"]["Enums"]["demanda_status"]
          texto_original: string
          tipo_documento: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          canal?: string
          categoria?: string | null
          centro_custo_id?: string | null
          checagens?: Json
          cnpj?: string | null
          codigo?: string
          confianca?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          extracao?: Json | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          motivos?: string[]
          n8n_execution_id?: string | null
          numero_documento?: string | null
          prioridade?: string | null
          recomendacao_ia?: string | null
          remetente_email?: string | null
          remetente_nome?: string | null
          rota?: string | null
          status?: Database["public"]["Enums"]["demanda_status"]
          texto_original: string
          tipo_documento?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          canal?: string
          categoria?: string | null
          centro_custo_id?: string | null
          checagens?: Json
          cnpj?: string | null
          codigo?: string
          confianca?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          extracao?: Json | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          motivos?: string[]
          n8n_execution_id?: string | null
          numero_documento?: string | null
          prioridade?: string | null
          recomendacao_ia?: string | null
          remetente_email?: string | null
          remetente_nome?: string | null
          rota?: string | null
          status?: Database["public"]["Enums"]["demanda_status"]
          texto_original?: string
          tipo_documento?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          criado_em: string
          dados: Json | null
          demanda_id: string | null
          etapa: string | null
          execution_id: string | null
          id: number
          mensagem: string | null
          origem: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json | null
          demanda_id?: string | null
          etapa?: string | null
          execution_id?: string | null
          id?: number
          mensagem?: string | null
          origem?: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          dados?: Json | null
          demanda_id?: string | null
          etapa?: string | null
          execution_id?: string | null
          id?: number
          mensagem?: string | null
          origem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          categoria_padrao: string | null
          cnpj: string
          criado_em: string
          homologado: boolean
          id: string
          razao_social: string
        }
        Insert: {
          categoria_padrao?: string | null
          cnpj: string
          criado_em?: string
          homologado?: boolean
          id?: string
          razao_social: string
        }
        Update: {
          categoria_padrao?: string | null
          cnpj?: string
          criado_em?: string
          homologado?: boolean
          id?: string
          razao_social?: string
        }
        Relationships: []
      }
      ia_execucoes: {
        Row: {
          criado_em: string
          demanda_id: string | null
          entrada_resumo: string | null
          erro: string | null
          id: string
          latencia_ms: number | null
          modelo: string | null
          saida: Json | null
          sucesso: boolean | null
        }
        Insert: {
          criado_em?: string
          demanda_id?: string | null
          entrada_resumo?: string | null
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          saida?: Json | null
          sucesso?: boolean | null
        }
        Update: {
          criado_em?: string
          demanda_id?: string | null
          entrada_resumo?: string | null
          erro?: string | null
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          saida?: Json | null
          sucesso?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_execucoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_segredos: {
        Row: {
          nome: string
          valor: string
        }
        Insert: {
          nome: string
          valor: string
        }
        Update: {
          nome?: string
          valor?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          criado_em: string
          data_agendada: string | null
          demanda_id: string
          id: string
          status: string
          valor: number | null
        }
        Insert: {
          criado_em?: string
          data_agendada?: string | null
          demanda_id: string
          id?: string
          status?: string
          valor?: number | null
        }
        Update: {
          criado_em?: string
          data_agendada?: string | null
          demanda_id?: string
          id?: string
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: true
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "analista" | "gestor" | "admin"
      demanda_status:
        | "recebida"
        | "em_analise"
        | "aguardando_aprovacao"
        | "aprovada_auto"
        | "aprovada"
        | "rejeitada"
        | "agendada"
        | "escalada"
        | "descartada"
        | "erro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["analista", "gestor", "admin"],
      demanda_status: [
        "recebida",
        "em_analise",
        "aguardando_aprovacao",
        "aprovada_auto",
        "aprovada",
        "rejeitada",
        "agendada",
        "escalada",
        "descartada",
        "erro",
      ],
    },
  },
} as const
