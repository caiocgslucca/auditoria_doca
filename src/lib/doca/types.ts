export type StatusAuditoria =
  | "pendente"
  | "em_andamento"
  | "finalizado_sem_divergencia"
  | "finalizado_com_divergencia";

export interface SeparadorInfo {
  cd_funcionario: number;
  nm_funcionario: string;
}

export interface ConferenteInfo {
  matricula: string | null;
  nome: string | null;
}

export interface PedidoDocaLinha {
  cd_empresa?: number | null;
  data_hora_integracao?: string | null;
  data_integracao?: string | null;
  data_hora_lib_onda?: string | null;
  data_lib_onda?: string | null;
  nu_doc_erp?: string | null;
  nu_pedido_origem: string;
  cd_onda?: number | null;
  cd_rota?: number | null;
  tp_pedido?: string | null;
  cd_situacao?: number | null;
  cd_classe?: string | null;
  cd_endereco?: string | null;
  cd_produto?: string | null;
  ds_produto?: string | null;
  qt_produto?: number | null;
  qt_separado?: number | null;
  qt_cancelado?: number | null;
  qtd_pendente?: number | null;
  data_hora_separacao?: string | null;
  cd_carga?: string | null;
  cd_funcionario?: number | null;
  nm_funcionario?: string | null;
  cd_turno?: number | null;
  data_separacao?: string | null;
  hora_separacao?: string | null;
  data_oficial?: string | null;
  turno_rota?: string | null;
  status_separacao?: string | null;
  data_sep_original?: string | null;
  ds?: string | null;
  nu_separacao?: number | null;
  nu_contenedor?: number | null;
  ds_onda?: string | null;
}

/** As 34 colunas aceitas na importação, na ordem oficial do layout. */
export const COLUNAS_IMPORTACAO: { cabecalho: string; campo: keyof PedidoDocaLinha; tipo: "string" | "number" | "date" }[] = [
  { cabecalho: "CD_EMPRESA", campo: "cd_empresa", tipo: "number" },
  { cabecalho: "DATA HORA INTEGRAÇÃO", campo: "data_hora_integracao", tipo: "date" },
  { cabecalho: "DATA INTEGRAÇÃO", campo: "data_integracao", tipo: "string" },
  { cabecalho: "DATA HORA LIB ONDA", campo: "data_hora_lib_onda", tipo: "date" },
  { cabecalho: "DATA LIB ONDA", campo: "data_lib_onda", tipo: "string" },
  { cabecalho: "NU_DOC_ERP", campo: "nu_doc_erp", tipo: "string" },
  { cabecalho: "NU_PEDIDO_ORIGEM", campo: "nu_pedido_origem", tipo: "string" },
  { cabecalho: "CD_ONDA", campo: "cd_onda", tipo: "number" },
  { cabecalho: "CD_ROTA", campo: "cd_rota", tipo: "number" },
  { cabecalho: "TP_PEDIDO", campo: "tp_pedido", tipo: "string" },
  { cabecalho: "CD_SITUACAO", campo: "cd_situacao", tipo: "number" },
  { cabecalho: "CD_CLASSE", campo: "cd_classe", tipo: "string" },
  { cabecalho: "CD_ENDERECO", campo: "cd_endereco", tipo: "string" },
  { cabecalho: "CD_PRODUTO", campo: "cd_produto", tipo: "string" },
  { cabecalho: "DS_PRODUTO", campo: "ds_produto", tipo: "string" },
  { cabecalho: "QT_PRODUTO", campo: "qt_produto", tipo: "number" },
  { cabecalho: "QT_SEPARADO", campo: "qt_separado", tipo: "number" },
  { cabecalho: "QT_CANCELADO", campo: "qt_cancelado", tipo: "number" },
  { cabecalho: "QTD_PENDENTE", campo: "qtd_pendente", tipo: "number" },
  { cabecalho: "DATA HORA SEPARAÇÃO", campo: "data_hora_separacao", tipo: "date" },
  { cabecalho: "CD_CARGA", campo: "cd_carga", tipo: "string" },
  { cabecalho: "CD_FUNCIONARIO", campo: "cd_funcionario", tipo: "number" },
  { cabecalho: "NM_FUNCIONARIO", campo: "nm_funcionario", tipo: "string" },
  { cabecalho: "CD_TURNO", campo: "cd_turno", tipo: "number" },
  { cabecalho: "DATA SEPARAÇÃO", campo: "data_separacao", tipo: "string" },
  { cabecalho: "HORA SEPARAÇÃO", campo: "hora_separacao", tipo: "string" },
  { cabecalho: "DATA OFICIAL", campo: "data_oficial", tipo: "string" },
  { cabecalho: "TURNO ROTA", campo: "turno_rota", tipo: "string" },
  { cabecalho: "STATUS_SEPARACAO", campo: "status_separacao", tipo: "string" },
  { cabecalho: "DATA_SEP_ORIGINAL", campo: "data_sep_original", tipo: "string" },
  { cabecalho: "DS", campo: "ds", tipo: "string" },
  { cabecalho: "NU_SEPARACAO", campo: "nu_separacao", tipo: "number" },
  { cabecalho: "NU_CONTENEDOR", campo: "nu_contenedor", tipo: "number" },
  { cabecalho: "DS_ONDA", campo: "ds_onda", tipo: "string" },
];

/** Colunas priorizadas na visualização principal do Temporário - Listagem. */
export const COLUNAS_VISIVEIS_TEMPORARIO: (keyof PedidoDocaLinha)[] = [
  "data_integracao",
  "data_lib_onda",
  "nu_doc_erp",
  "nu_pedido_origem",
  "cd_onda",
  "cd_rota",
  "cd_classe",
  "cd_endereco",
  "cd_produto",
  "ds_produto",
  "qt_produto",
  "qt_separado",
  "qt_cancelado",
  "qtd_pendente",
  "cd_funcionario",
  "nm_funcionario",
  "data_separacao",
  "status_separacao",
  "nu_separacao",
  "nu_contenedor",
  "ds_onda",
];
