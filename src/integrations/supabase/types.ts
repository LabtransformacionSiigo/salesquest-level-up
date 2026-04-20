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
      asesores: {
        Row: {
          activo: boolean | null
          avatar_url: string | null
          canal: string | null
          canal_direccion: string | null
          created_at: string | null
          documento: string | null
          email: string
          gerente_id: string
          id: string
          nombre: string
          pais: string | null
          sp_canje: number
          sp_convencion: number | null
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          avatar_url?: string | null
          canal?: string | null
          canal_direccion?: string | null
          created_at?: string | null
          documento?: string | null
          email: string
          gerente_id: string
          id?: string
          nombre: string
          pais?: string | null
          sp_canje?: number
          sp_convencion?: number | null
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          avatar_url?: string | null
          canal?: string | null
          canal_direccion?: string | null
          created_at?: string | null
          documento?: string | null
          email?: string
          gerente_id?: string
          id?: string
          nombre?: string
          pais?: string | null
          sp_canje?: number
          sp_convencion?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "asesores_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      canjes: {
        Row: {
          estado: string
          fecha_canje: string
          gerente_id: string
          id: string
          premio_id: string
          puntos_gastados: number
        }
        Insert: {
          estado?: string
          fecha_canje?: string
          gerente_id: string
          id?: string
          premio_id: string
          puntos_gastados: number
        }
        Update: {
          estado?: string
          fecha_canje?: string
          gerente_id?: string
          id?: string
          premio_id?: string
          puntos_gastados?: number
        }
        Relationships: [
          {
            foreignKeyName: "canjes_premio_id_fkey"
            columns: ["premio_id"]
            isOneToOne: false
            referencedRelation: "premios"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_medallas: {
        Row: {
          activo: boolean | null
          canal: string
          cantidad_requerida: number | null
          condicion_tipo: string
          created_at: string | null
          descripcion: string | null
          emoji: string | null
          id: string
          nombre: string
          objetivo_descripcion: string | null
          operacion: string | null
          pais: string | null
          producto: string | null
          sp: number
          tipo_evento: string | null
        }
        Insert: {
          activo?: boolean | null
          canal: string
          cantidad_requerida?: number | null
          condicion_tipo?: string
          created_at?: string | null
          descripcion?: string | null
          emoji?: string | null
          id?: string
          nombre: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          producto?: string | null
          sp?: number
          tipo_evento?: string | null
        }
        Update: {
          activo?: boolean | null
          canal?: string
          cantidad_requerida?: number | null
          condicion_tipo?: string
          created_at?: string | null
          descripcion?: string | null
          emoji?: string | null
          id?: string
          nombre?: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          producto?: string | null
          sp?: number
          tipo_evento?: string | null
        }
        Relationships: []
      }
      catalogo_retos: {
        Row: {
          activo: boolean
          created_at: string
          emoji: string | null
          familia: string | null
          id: string
          nombre: string
          objetivo_descripcion: string | null
          operacion: string | null
          pais: string | null
          sp_otorgados: number
          tipo_metrica: string
          umbral: number
          ventana_tiempo: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          emoji?: string | null
          familia?: string | null
          id?: string
          nombre: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          sp_otorgados?: number
          tipo_metrica: string
          umbral?: number
          ventana_tiempo: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          emoji?: string | null
          familia?: string | null
          id?: string
          nombre?: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          sp_otorgados?: number
          tipo_metrica?: string
          umbral?: number
          ventana_tiempo?: string
        }
        Relationships: []
      }
      config_rachas: {
        Row: {
          activo: boolean | null
          canal: string
          condicion_tipo: string
          created_at: string | null
          descripcion: string | null
          dias_requeridos: number | null
          id: string
          multiplicador_sp: number | null
          nombre: string
          objetivo_descripcion: string | null
          operacion: string | null
          pais: string | null
          umbral_verde: number | null
        }
        Insert: {
          activo?: boolean | null
          canal: string
          condicion_tipo?: string
          created_at?: string | null
          descripcion?: string | null
          dias_requeridos?: number | null
          id?: string
          multiplicador_sp?: number | null
          nombre: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          umbral_verde?: number | null
        }
        Update: {
          activo?: boolean | null
          canal?: string
          condicion_tipo?: string
          created_at?: string | null
          descripcion?: string | null
          dias_requeridos?: number | null
          id?: string
          multiplicador_sp?: number | null
          nombre?: string
          objetivo_descripcion?: string | null
          operacion?: string | null
          pais?: string | null
          umbral_verde?: number | null
        }
        Relationships: []
      }
      ejecucion_asesores: {
        Row: {
          acv_total: number | null
          canal_direccion: string
          cant_recomendados: number | null
          created_at: string | null
          documento_asesor: string
          id: string
          pais: string | null
          periodo: string
          productividad: number | null
          ventas_fe: number | null
          ventas_nube: number | null
          ventas_total: number | null
        }
        Insert: {
          acv_total?: number | null
          canal_direccion: string
          cant_recomendados?: number | null
          created_at?: string | null
          documento_asesor: string
          id?: string
          pais?: string | null
          periodo: string
          productividad?: number | null
          ventas_fe?: number | null
          ventas_nube?: number | null
          ventas_total?: number | null
        }
        Update: {
          acv_total?: number | null
          canal_direccion?: string
          cant_recomendados?: number | null
          created_at?: string | null
          documento_asesor?: string
          id?: string
          pais?: string | null
          periodo?: string
          productividad?: number | null
          ventas_fe?: number | null
          ventas_nube?: number | null
          ventas_total?: number | null
        }
        Relationships: []
      }
      especialista_permisos: {
        Row: {
          created_at: string
          email: string
          id: string
          nombre: string
          operaciones: string[]
          paises: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nombre: string
          operaciones?: string[]
          paises?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          operaciones?: string[]
          paises?: string[]
          user_id?: string
        }
        Relationships: []
      }
      gerentes: {
        Row: {
          activo: boolean | null
          avatar_url: string | null
          canal: string | null
          celula: string | null
          created_at: string | null
          email: string
          id: string
          lider: string | null
          nombre: string
          pais: string | null
          sp_canje: number
          sp_convencion: number
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          avatar_url?: string | null
          canal?: string | null
          celula?: string | null
          created_at?: string | null
          email: string
          id?: string
          lider?: string | null
          nombre: string
          pais?: string | null
          sp_canje?: number
          sp_convencion?: number
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          avatar_url?: string | null
          canal?: string | null
          celula?: string | null
          created_at?: string | null
          email?: string
          id?: string
          lider?: string | null
          nombre?: string
          pais?: string | null
          sp_canje?: number
          sp_convencion?: number
          user_id?: string | null
        }
        Relationships: []
      }
      kpis_mensuales: {
        Row: {
          acv_f: number | null
          anio_mes: string
          canal: string | null
          cant_recomendados: number | null
          gerente_id: string
          hc_final: number | null
          hc_inicial: number | null
          meta: number | null
          moneda: string | null
          sa_creados: number | null
          sc_creados: number | null
          terminaciones: number | null
          ventas: number | null
          ventas_recomendados: number | null
          ventas_sql: number | null
        }
        Insert: {
          acv_f?: number | null
          anio_mes: string
          canal?: string | null
          cant_recomendados?: number | null
          gerente_id: string
          hc_final?: number | null
          hc_inicial?: number | null
          meta?: number | null
          moneda?: string | null
          sa_creados?: number | null
          sc_creados?: number | null
          terminaciones?: number | null
          ventas?: number | null
          ventas_recomendados?: number | null
          ventas_sql?: number | null
        }
        Update: {
          acv_f?: number | null
          anio_mes?: string
          canal?: string | null
          cant_recomendados?: number | null
          gerente_id?: string
          hc_final?: number | null
          hc_inicial?: number | null
          meta?: number | null
          moneda?: string | null
          sa_creados?: number | null
          sc_creados?: number | null
          terminaciones?: number | null
          ventas?: number | null
          ventas_recomendados?: number | null
          ventas_sql?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "kpis_mensuales_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      medallas: {
        Row: {
          fecha_desbloqueo: string | null
          gerente_id: string
          medalla: string
          sp_otorgados: number | null
        }
        Insert: {
          fecha_desbloqueo?: string | null
          gerente_id: string
          medalla: string
          sp_otorgados?: number | null
        }
        Update: {
          fecha_desbloqueo?: string | null
          gerente_id?: string
          medalla?: string
          sp_otorgados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "medallas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_asesores: {
        Row: {
          anio_mes: string
          aplica_cuota_lider: string | null
          aplica_ejecucion_lider: string | null
          aplica_hc_minimo: string | null
          canal_direccion: string
          caso_salud_ocupacional: string | null
          celula: string | null
          created_at: string | null
          dias_novedad: number | null
          dias_softlanding: number | null
          documento_asesor: string
          fe_bono: number | null
          fecha_ingreso_asesor: string | null
          gerente: string | null
          id: string
          m_de_antiguedad: number | null
          meta_fe: number | null
          meta_nube: number | null
          meta_recomendados_bono: number | null
          meta_sql_bono: number | null
          meta_total: number | null
          nombre_asesor: string | null
          novedad: string | null
          nube_bono: number | null
          pais: string | null
          proyecto: string | null
          reingreso: string | null
          total_bono: number | null
        }
        Insert: {
          anio_mes: string
          aplica_cuota_lider?: string | null
          aplica_ejecucion_lider?: string | null
          aplica_hc_minimo?: string | null
          canal_direccion: string
          caso_salud_ocupacional?: string | null
          celula?: string | null
          created_at?: string | null
          dias_novedad?: number | null
          dias_softlanding?: number | null
          documento_asesor: string
          fe_bono?: number | null
          fecha_ingreso_asesor?: string | null
          gerente?: string | null
          id?: string
          m_de_antiguedad?: number | null
          meta_fe?: number | null
          meta_nube?: number | null
          meta_recomendados_bono?: number | null
          meta_sql_bono?: number | null
          meta_total?: number | null
          nombre_asesor?: string | null
          novedad?: string | null
          nube_bono?: number | null
          pais?: string | null
          proyecto?: string | null
          reingreso?: string | null
          total_bono?: number | null
        }
        Update: {
          anio_mes?: string
          aplica_cuota_lider?: string | null
          aplica_ejecucion_lider?: string | null
          aplica_hc_minimo?: string | null
          canal_direccion?: string
          caso_salud_ocupacional?: string | null
          celula?: string | null
          created_at?: string | null
          dias_novedad?: number | null
          dias_softlanding?: number | null
          documento_asesor?: string
          fe_bono?: number | null
          fecha_ingreso_asesor?: string | null
          gerente?: string | null
          id?: string
          m_de_antiguedad?: number | null
          meta_fe?: number | null
          meta_nube?: number | null
          meta_recomendados_bono?: number | null
          meta_sql_bono?: number | null
          meta_total?: number | null
          nombre_asesor?: string | null
          novedad?: string | null
          nube_bono?: number | null
          pais?: string | null
          proyecto?: string | null
          reingreso?: string | null
          total_bono?: number | null
        }
        Relationships: []
      }
      metas_gerentes: {
        Row: {
          canal_direccion: string
          celula: string
          coi: number | null
          created_at: string | null
          cuota: number | null
          director: string | null
          efectividad_sql: number | null
          fe: number | null
          hc_operativo: number | null
          id: string
          m: string | null
          meta_total_acv: number | null
          meta_total_acv_formato: string | null
          meta_total_und: number | null
          noi: number | null
          nube: number | null
          pais_gestion: string | null
          productividad: number | null
          recomendados: number | null
          siigo_fiscal: number | null
        }
        Insert: {
          canal_direccion: string
          celula: string
          coi?: number | null
          created_at?: string | null
          cuota?: number | null
          director?: string | null
          efectividad_sql?: number | null
          fe?: number | null
          hc_operativo?: number | null
          id?: string
          m?: string | null
          meta_total_acv?: number | null
          meta_total_acv_formato?: string | null
          meta_total_und?: number | null
          noi?: number | null
          nube?: number | null
          pais_gestion?: string | null
          productividad?: number | null
          recomendados?: number | null
          siigo_fiscal?: number | null
        }
        Update: {
          canal_direccion?: string
          celula?: string
          coi?: number | null
          created_at?: string | null
          cuota?: number | null
          director?: string | null
          efectividad_sql?: number | null
          fe?: number | null
          hc_operativo?: number | null
          id?: string
          m?: string | null
          meta_total_acv?: number | null
          meta_total_acv_formato?: string | null
          meta_total_und?: number | null
          noi?: number | null
          nube?: number | null
          pais_gestion?: string | null
          productividad?: number | null
          recomendados?: number | null
          siigo_fiscal?: number | null
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          created_at: string | null
          gerente_id: string
          id: string
          leida: boolean | null
          mensaje: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          gerente_id: string
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          gerente_id?: string
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      premios: {
        Row: {
          activo: boolean
          costo_puntos: number
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          stock: number
        }
        Insert: {
          activo?: boolean
          costo_puntos: number
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          stock?: number
        }
        Update: {
          activo?: boolean
          costo_puntos?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          stock?: number
        }
        Relationships: []
      }
      productividad_asesores: {
        Row: {
          acv_f: number | null
          anio_mes: string
          area: string | null
          asesor: string
          cant_recomendados: number | null
          celula: string | null
          created_at: string | null
          director: string | null
          id: string
          meta: number | null
          pais: string | null
          rango_antiguedad: string | null
          sc_creados: number | null
          ventas: number | null
          ventas_mm_recomendados: number | null
          ventas_mm_sql: number | null
        }
        Insert: {
          acv_f?: number | null
          anio_mes: string
          area?: string | null
          asesor: string
          cant_recomendados?: number | null
          celula?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          meta?: number | null
          pais?: string | null
          rango_antiguedad?: string | null
          sc_creados?: number | null
          ventas?: number | null
          ventas_mm_recomendados?: number | null
          ventas_mm_sql?: number | null
        }
        Update: {
          acv_f?: number | null
          anio_mes?: string
          area?: string | null
          asesor?: string
          cant_recomendados?: number | null
          celula?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          meta?: number | null
          pais?: string | null
          rango_antiguedad?: string | null
          sc_creados?: number | null
          ventas?: number | null
          ventas_mm_recomendados?: number | null
          ventas_mm_sql?: number | null
        }
        Relationships: []
      }
      rachas: {
        Row: {
          anio: number
          estado: string | null
          gerente_id: string
          ingresos_semana: number | null
          multiplicador: number | null
          semana_iso: number
          semanas_consecutivas: number | null
        }
        Insert: {
          anio: number
          estado?: string | null
          gerente_id: string
          ingresos_semana?: number | null
          multiplicador?: number | null
          semana_iso: number
          semanas_consecutivas?: number | null
        }
        Update: {
          anio?: number
          estado?: string | null
          gerente_id?: string
          ingresos_semana?: number | null
          multiplicador?: number | null
          semana_iso?: number
          semanas_consecutivas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      reconocimientos: {
        Row: {
          anio: number | null
          created_at: string | null
          de_gerente_id: string | null
          id: string
          mensaje: string | null
          para_gerente_id: string | null
          para_nombre: string | null
          semana_iso: number | null
          sp_de: number | null
          sp_para: number | null
          tipo: string | null
        }
        Insert: {
          anio?: number | null
          created_at?: string | null
          de_gerente_id?: string | null
          id?: string
          mensaje?: string | null
          para_gerente_id?: string | null
          para_nombre?: string | null
          semana_iso?: number | null
          sp_de?: number | null
          sp_para?: number | null
          tipo?: string | null
        }
        Update: {
          anio?: number | null
          created_at?: string | null
          de_gerente_id?: string | null
          id?: string
          mensaje?: string | null
          para_gerente_id?: string | null
          para_nombre?: string | null
          semana_iso?: number | null
          sp_de?: number | null
          sp_para?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_de_gerente_id_fkey"
            columns: ["de_gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "reconocimientos_para_gerente_id_fkey"
            columns: ["para_gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      retos_completados: {
        Row: {
          fecha: string | null
          gerente_id: string
          periodo: string
          reto: string
          sp: number | null
          tipo: string | null
        }
        Insert: {
          fecha?: string | null
          gerente_id: string
          periodo: string
          reto: string
          sp?: number | null
          tipo?: string | null
        }
        Update: {
          fecha?: string | null
          gerente_id?: string
          periodo?: string
          reto?: string
          sp?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "retos_completados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_acumulados: {
        Row: {
          created_at: string | null
          detalle: string | null
          fuente: string | null
          gerente_id: string | null
          id: string
          periodo: string
          sp: number
          tipo_sp: string
        }
        Insert: {
          created_at?: string | null
          detalle?: string | null
          fuente?: string | null
          gerente_id?: string | null
          id?: string
          periodo: string
          sp: number
          tipo_sp?: string
        }
        Update: {
          created_at?: string | null
          detalle?: string | null
          fuente?: string | null
          gerente_id?: string | null
          id?: string
          periodo?: string
          sp?: number
          tipo_sp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "sp_acumulados_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          mode: string
          requested_by: string | null
          result: Json | null
          started_at: string | null
          status: string
          table_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          table_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          requested_by?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          table_name?: string
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
      ventas: {
        Row: {
          acv_plus: number | null
          anio: number | null
          bloque_venta: string | null
          canal: string | null
          categoria_producto_venta: string | null
          comercial: string | null
          created_at: string | null
          documento_factura: string | null
          fecha_facturacion: string
          gerente_id: string | null
          id: string
          lider: string | null
          mes: string | null
          meta: number | null
          origen: string | null
          pais: string | null
          producto: string | null
          recurrencia: string | null
          sc_creados_ind: number | null
          valor_producto: number | null
        }
        Insert: {
          acv_plus?: number | null
          anio?: number | null
          bloque_venta?: string | null
          canal?: string | null
          categoria_producto_venta?: string | null
          comercial?: string | null
          created_at?: string | null
          documento_factura?: string | null
          fecha_facturacion: string
          gerente_id?: string | null
          id?: string
          lider?: string | null
          mes?: string | null
          meta?: number | null
          origen?: string | null
          pais?: string | null
          producto?: string | null
          recurrencia?: string | null
          sc_creados_ind?: number | null
          valor_producto?: number | null
        }
        Update: {
          acv_plus?: number | null
          anio?: number | null
          bloque_venta?: string | null
          canal?: string | null
          categoria_producto_venta?: string | null
          comercial?: string | null
          created_at?: string | null
          documento_factura?: string | null
          fecha_facturacion?: string
          gerente_id?: string | null
          id?: string
          lider?: string | null
          mes?: string | null
          meta?: number | null
          origen?: string | null
          pais?: string | null
          producto?: string | null
          recurrencia?: string | null
          sc_creados_ind?: number | null
          valor_producto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas_diarias: {
        Row: {
          acv: number | null
          asesor: string
          canal_direccion: string
          celula: string | null
          created_at: string | null
          director: string | null
          equipo: string | null
          fecha: string | null
          id: string
          origen: string | null
          pais: string | null
          producto: string | null
          recurrencia: string | null
          tipo_producto: string | null
          unidades: number | null
        }
        Insert: {
          acv?: number | null
          asesor: string
          canal_direccion: string
          celula?: string | null
          created_at?: string | null
          director?: string | null
          equipo?: string | null
          fecha?: string | null
          id?: string
          origen?: string | null
          pais?: string | null
          producto?: string | null
          recurrencia?: string | null
          tipo_producto?: string | null
          unidades?: number | null
        }
        Update: {
          acv?: number | null
          asesor?: string
          canal_direccion?: string
          celula?: string | null
          created_at?: string | null
          director?: string | null
          equipo?: string | null
          fecha?: string | null
          id?: string
          origen?: string | null
          pais?: string | null
          producto?: string | null
          recurrencia?: string | null
          tipo_producto?: string | null
          unidades?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      acv_vc_mensual: {
        Row: {
          acv_conversiones: number | null
          acv_fe: number | null
          acv_nomina: number | null
          acv_plus_total: number | null
          anio: number | null
          gerente_id: string | null
          mes: string | null
          meta_total: number | null
          nombre: string | null
          unidades: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      comerciales_por_gerente: {
        Row: {
          gerente_id: string | null
          gerente_nombre: string | null
          nombre: string | null
        }
        Relationships: []
      }
      desglose_producto_vc: {
        Row: {
          acv_total: number | null
          anio: number | null
          gerente_id: string | null
          mes: string | null
          producto: string | null
          unidades: number | null
        }
        Relationships: []
      }
      desglose_producto_vn: {
        Row: {
          acv_total: number | null
          anio: number | null
          canal: string | null
          gerente_id: string | null
          mes: string | null
          producto: string | null
          unidades: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reconocimientos: {
        Row: {
          created_at: string | null
          de_avatar: string | null
          de_nombre: string | null
          id: string | null
          mensaje: string | null
          para_avatar: string | null
          para_nombre: string | null
          sp_de: number | null
          sp_para: number | null
          tipo: string | null
        }
        Relationships: []
      }
      kpis_mes_actual: {
        Row: {
          acv_f: number | null
          anio_mes: string | null
          canal: string | null
          cant_recomendados: number | null
          efectividad_referidos_pct: number | null
          efectividad_sql_pct: number | null
          gerente_id: string | null
          hc_final: number | null
          meta: number | null
          nombre: string | null
          pais: string | null
          pct_cumplimiento: number | null
          productividad_por_asesor: number | null
          sc_creados: number | null
          terminaciones: number | null
          ventas: number | null
          ventas_recomendados: number | null
          ventas_sql: number | null
        }
        Relationships: []
      }
      racha_activa: {
        Row: {
          anio: number | null
          estado: string | null
          gerente_id: string | null
          multiplicador: number | null
          nombre_racha: string | null
          semana_iso: number | null
          semanas_consecutivas: number | null
          umbral_verde: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "rachas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_general: {
        Row: {
          avatar_url: string | null
          canal: string | null
          id: string | null
          nivel: string | null
          nombre: string | null
          pais: string | null
          posicion: number | null
          posicion_canal: number | null
          sp_totales: number | null
          user_id: string | null
        }
        Relationships: []
      }
      ranking_vc_comerciales: {
        Row: {
          acv_total: number | null
          gerente_nombre: string | null
          meta_total: number | null
          nombre: string | null
          pct_cumplimiento: number | null
          posicion: number | null
          ventas_count: number | null
        }
        Relationships: []
      }
      ranking_vc_gerentes: {
        Row: {
          acv_total: number | null
          gerente_id: string | null
          mes: string | null
          meta_total: number | null
          nombre: string | null
          pais: string | null
          pct_cumplimiento: number | null
          posicion: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "acv_vc_mensual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "comerciales_por_gerente"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "kpis_mes_actual"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "ranking_vn_gerentes"
            referencedColumns: ["gerente_id"]
          },
          {
            foreignKeyName: "ventas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "sp_totales_gerente"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_vn_comerciales: {
        Row: {
          acv_total: number | null
          canal: string | null
          cant_recomendados: number | null
          gerente_nombre: string | null
          nombre: string | null
          pais_gerente: string | null
          posicion: number | null
          unidades_total: number | null
          ventas_count: number | null
        }
        Relationships: []
      }
      ranking_vn_gerentes: {
        Row: {
          acv_total: number | null
          canal: string | null
          cant_recomendados: number | null
          gerente_id: string | null
          mes_periodo: string | null
          meta_fe: number | null
          meta_nube: number | null
          meta_unidades: number | null
          nombre: string | null
          pais: string | null
          pct_cumplimiento: number | null
          posicion: number | null
          sc_creados: number | null
          unidades_logradas: number | null
          ventas_fe: number | null
          ventas_nube: number | null
        }
        Relationships: []
      }
      sp_acumulados_comerciales: {
        Row: {
          nombre: string | null
          sp_totales: number | null
        }
        Relationships: []
      }
      sp_totales_gerente: {
        Row: {
          activo: boolean | null
          avatar_url: string | null
          canal: string | null
          id: string | null
          lider: string | null
          nivel: string | null
          nombre: string | null
          pais: string | null
          sp_convencion: number | null
          sp_nivel_actual: number | null
          sp_siguiente_nivel: number | null
          sp_totales: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calcular_multiplicador: {
        Args: { semanas_consecutivas: number }
        Returns: number
      }
      calcular_sp_cop: { Args: { ingresos_cop: number }; Returns: number }
      canjear_premio: {
        Args: { p_gerente_id: string; p_premio_id: string }
        Returns: Json
      }
      especialista_puede: {
        Args: { _operacion: string; _pais: string }
        Returns: boolean
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_puntos_canjeables: {
        Args: { p_amount: number; p_gerente_id: string }
        Returns: undefined
      }
      increment_sp_canje: {
        Args: { p_amount: number; p_gerente_id: string }
        Returns: undefined
      }
      mes_actual_nombre: { Args: never; Returns: string }
      otorgar_medalla_si_aplica: {
        Args: { p_gerente_id: string; p_medalla: string; p_sp: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gerente" | "asesor" | "especialista"
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
      app_role: ["admin", "gerente", "asesor", "especialista"],
    },
  },
} as const
