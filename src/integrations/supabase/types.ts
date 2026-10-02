export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          matricula: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      user_roles: {
        Row: { id: string; user_id: string; role: "admin" | "user"; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> & { user_id: string; role: "admin" | "user" };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
      };
      import_batches: {
        Row: {
          id: string;
          arquivo_nome: string;
          linhas_total: number;
          linhas_validas: number;
          linhas_erro: number;
          status: "processando" | "concluido" | "erro";
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["import_batches"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["import_batches"]["Row"]>;
      };
      pedidos_doca_temp: {
        Row: {
          id: string;
          import_batch_id: string | null;
          cd_empresa: number | null;
          data_hora_integracao: string | null;
          data_integracao: string | null;
          data_hora_lib_onda: string | null;
          data_lib_onda: string | null;
          nu_doc_erp: string | null;
          nu_pedido_origem: string;
          cd_onda: number | null;
          cd_rota: number | null;
          tp_pedido: string | null;
          cd_situacao: number | null;
          cd_classe: string | null;
          cd_endereco: string | null;
          cd_produto: string | null;
          ds_produto: string | null;
          qt_produto: number | null;
          qt_separado: number | null;
          qt_cancelado: number | null;
          qtd_pendente: number | null;
          data_hora_separacao: string | null;
          cd_carga: string | null;
          cd_funcionario: number | null;
          nm_funcionario: string | null;
          cd_turno: number | null;
          data_separacao: string | null;
          hora_separacao: string | null;
          data_oficial: string | null;
          turno_rota: string | null;
          status_separacao: string | null;
          data_sep_original: string | null;
          ds: string | null;
          nu_separacao: number | null;
          nu_contenedor: number | null;
          ds_onda: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pedidos_doca_temp"]["Row"]> & { nu_pedido_origem: string };
        Update: Partial<Database["public"]["Tables"]["pedidos_doca_temp"]["Row"]>;
      };
      pedidos_doca: {
        Row: {
          id: string;
          nu_pedido_origem: string;
          nu_doc_erp: string | null;
          cd_rota: number | null;
          cd_classe: string | null;
          cd_onda: number | null;
          ds_onda: string | null;
          data_integracao: string | null;
          data_lib_onda: string | null;
          status_separacao: string | null;
          qtde_contar: number;
          status_atual: "pendente" | "em_andamento" | "finalizado_sem_divergencia" | "finalizado_com_divergencia";
          auditoria_atual_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pedidos_doca"]["Row"]> & { nu_pedido_origem: string };
        Update: Partial<Database["public"]["Tables"]["pedidos_doca"]["Row"]>;
      };
      pedidos_doca_itens: {
        Row: Database["public"]["Tables"]["pedidos_doca_temp"]["Row"] & { pedido_doca_id: string };
        Insert: Partial<Database["public"]["Tables"]["pedidos_doca_itens"]["Row"]> & { pedido_doca_id: string; nu_pedido_origem: string };
        Update: Partial<Database["public"]["Tables"]["pedidos_doca_itens"]["Row"]>;
      };
      doca_pedido_separadores: {
        Row: { id: string; pedido_doca_id: string; cd_funcionario: number; nm_funcionario: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["doca_pedido_separadores"]["Row"]> & { pedido_doca_id: string; cd_funcionario: number; nm_funcionario: string };
        Update: Partial<Database["public"]["Tables"]["doca_pedido_separadores"]["Row"]>;
      };
      doca_notas_fiscais: {
        Row: { id: string; pedido_doca_id: string; numero_nf: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["doca_notas_fiscais"]["Row"]> & { pedido_doca_id: string; numero_nf: string };
        Update: Partial<Database["public"]["Tables"]["doca_notas_fiscais"]["Row"]>;
      };
      doca_auditorias: {
        Row: {
          id: string;
          pedido_doca_id: string;
          rota: number | null;
          pedido: string;
          nota_fiscal: string | null;
          classe: string | null;
          qtde_contar: number;
          qtde_contada: number | null;
          dif: number | null;
          percentual_dif: number | null;
          status: "em_andamento" | "finalizado_sem_divergencia" | "finalizado_com_divergencia";
          user_id_conferente: string | null;
          matricula_conferente: string | null;
          nome_conferente: string | null;
          data_hora_inicio: string;
          data_hora_finalizacao: string | null;
          is_current: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["doca_auditorias"]["Row"]> & { pedido_doca_id: string; pedido: string; qtde_contar: number };
        Update: Partial<Database["public"]["Tables"]["doca_auditorias"]["Row"]>;
      };
      doca_auditoria_fotos: {
        Row: { id: string; auditoria_id: string; storage_path: string; nome_arquivo: string; tipo: string | null; created_at: string; created_by: string | null };
        Insert: Partial<Database["public"]["Tables"]["doca_auditoria_fotos"]["Row"]> & { auditoria_id: string; storage_path: string; nome_arquivo: string };
        Update: Partial<Database["public"]["Tables"]["doca_auditoria_fotos"]["Row"]>;
      };
      doca_auditoria_observacoes: {
        Row: { id: string; auditoria_id: string; observacao: string; user_id: string | null; matricula: string | null; nome: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["doca_auditoria_observacoes"]["Row"]> & { auditoria_id: string; observacao: string };
        Update: Partial<Database["public"]["Tables"]["doca_auditoria_observacoes"]["Row"]>;
      };
    };
  };
};
