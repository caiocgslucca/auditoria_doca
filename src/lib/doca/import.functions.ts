import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { calcularQtdeContar } from "./rules";

/**
 * Colunas EXATAS do novo arquivo de importação (34 colunas).
 * A validação é feita pelo NOME DO CABEÇALHO, nunca por posição.
 */
export const COLUNAS_IMPORTACAO_DOCA = [
  "CD_EMPRESA",
  "DATA HORA INTEGRAÇÃO",
  "DATA INTEGRAÇÃO",
  "DATA HORA LIB ONDA",
  "DATA LIB ONDA",
  "NU_DOC_ERP",
  "NU_PEDIDO_ORIGEM",
  "CD_ONDA",
  "CD_ROTA",
  "TP_PEDIDO",
  "CD_SITUACAO",
  "CD_CLASSE",
  "CD_ENDERECO",
  "CD_PRODUTO",
  "DS_PRODUTO",
  "QT_PRODUTO",
  "QT_SEPARADO",
  "QT_CANCELADO",
  "QTD_PENDENTE",
  "DATA HORA SEPARAÇÃO",
  "CD_CARGA",
  "CD_FUNCIONARIO",
  "NM_FUNCIONARIO",
  "CD_TURNO",
  "DATA SEPARAÇÃO",
  "HORA SEPARAÇÃO",
  "DATA OFICIAL",
  "TURNO ROTA",
  "STATUS_SEPARACAO",
  "DATA_SEP_ORIGINAL",
  "DS",
  "NU_SEPARACAO",
  "NU_CONTENEDOR",
  "DS_ONDA",
] as const;

export interface ValidacaoImportacao {
  arquivoNome: string;
  linhasEncontradas: number;
  colunasEncontradas: string[];
  colunasValidas: string[];
  colunasAusentes: string[];
  linhasValidas: number;
  linhasComErro: number;
  podeImportar: boolean;
}

export function validarCabecalho(arquivoNome: string, colunas: string[], totalLinhas: number): ValidacaoImportacao {
  const normalizadas = colunas.map((c) => c.trim());
  const colunasAusentes = COLUNAS_IMPORTACAO_DOCA.filter((esperada) => !normalizadas.includes(esperada));
  const colunasValidas = normalizadas.filter((c) => (COLUNAS_IMPORTACAO_DOCA as readonly string[]).includes(c));
  return {
    arquivoNome,
    linhasEncontradas: totalLinhas,
    colunasEncontradas: normalizadas,
    colunasValidas,
    colunasAusentes,
    linhasValidas: totalLinhas,
    linhasComErro: 0,
    podeImportar: colunasAusentes.length === 0,
  };
}

export interface LinhaImportacaoDoca {
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

/**
 * Importa as linhas para a área de STAGING (pedidos_doca_temp).
 * Isso é apenas o passo 1: a persistência operacional (pedidos_doca +
 * separadores) ocorre em efetivarImportacaoParaOperacional.
 */
export const importarParaTemporario = createServerFn({ method: "POST" })
  .validator((linhas: LinhaImportacaoDoca[]) => linhas)
  .handler(async ({ data: linhas }) => {
    if (!linhas.length) {
      return { inseridos: 0 };
    }
    const { error, count } = await supabase
      .from("pedidos_doca_temp")
      .insert(linhas as any, { count: "exact" });
    if (error) throw new Error(error.message);
    return { inseridos: count ?? linhas.length };
  });

/**
 * REGRA CRÍTICA (item 10 do pedido):
 * Para cada pedido presente no staging, localiza/cria o registro
 * operacional em pedidos_doca e persiste o(s) separador(es)
 * (CD_FUNCIONARIO + NM_FUNCIONARIO) em doca_pedido_separadores.
 * Essa persistência é definitiva: limpar o staging NUNCA remove isso.
 */
// Persiste definitivamente o(s) Separador(es) (CD_FUNCIONARIO + NM_FUNCIONARIO)
// de cada pedido do staging em doca_pedido_separadores, vinculados ao
// pedido operacional (pedidos_doca). Essa gravação SOBREVIVE a qualquer
// "Limpar Dados do Dia" (que afeta somente pedidos_doca_temp).
export const efetivarImportacaoParaOperacional = createServerFn({ method: "POST" }).handler(async () => {
  const { data: temp, error: errTemp } = await supabase.from("pedidos_doca_temp").select("*");
  if (errTemp) throw new Error(errTemp.message);
  if (!temp || temp.length === 0) return { pedidosProcessados: 0, separadoresPersistidos: 0 };

  let pedidosProcessados = 0;
  let separadoresPersistidos = 0;

  // Agrupa por pedido para tratar múltiplos separadores/linhas do mesmo pedido.
  const porPedido = new Map<string, any[]>();
  for (const linha of temp) {
    const pedido = linha.nu_pedido_origem as string;
    if (!pedido) continue;
    if (!porPedido.has(pedido)) porPedido.set(pedido, []);
    porPedido.get(pedido)!.push(linha);
  }

  for (const [pedido, linhas] of porPedido) {
    const primeira = linhas[0];

    const { data: existente, error: errBusca } = await supabase
      .from("pedidos_doca")
      .select("id")
      .eq("nu_pedido_origem", pedido)
      .maybeSingle();
    if (errBusca) throw new Error(errBusca.message);

    let pedidoDocaId = existente?.id as string | undefined;

    const qtdeContar = calcularQtdeContar({
      cd_classe: primeira.cd_classe ?? null,
      qt_produto: primeira.qt_produto ?? null,
      qt_separado: primeira.qt_separado ?? null,
      qt_cancelado: primeira.qt_cancelado ?? null,
      qtd_pendente: primeira.qtd_pendente ?? null,
      nu_contenedor: primeira.nu_contenedor ?? null,
    });

    const payloadPedido = {
      nu_pedido_origem: pedido,
      nu_doc_erp: primeira.nu_doc_erp ?? null,
      cd_rota: primeira.cd_rota ?? null,
      cd_classe: primeira.cd_classe ?? null,
      cd_onda: primeira.cd_onda ?? null,
      ds_onda: primeira.ds_onda ?? null,
      cd_produto: primeira.cd_produto ?? null,
      ds_produto: primeira.ds_produto ?? null,
      qt_produto: primeira.qt_produto ?? null,
      qt_separado: primeira.qt_separado ?? null,
      qt_cancelado: primeira.qt_cancelado ?? null,
      qtd_pendente: primeira.qtd_pendente ?? null,
      nu_contenedor: primeira.nu_contenedor ?? null,
      status_separacao: primeira.status_separacao ?? null,
      data_integracao: primeira.data_integracao ?? null,
      data_separacao: primeira.data_separacao ?? null,
      qtde_contar: qtdeContar,
    };

    if (!pedidoDocaId) {
      const { data: criado, error: errCriar } = await supabase
        .from("pedidos_doca")
        .insert(payloadPedido as any)
        .select("id")
        .single();
      if (errCriar) throw new Error(errCriar.message);
      pedidoDocaId = criado!.id;
    } else {
      const { error: errUpdate } = await supabase
        .from("pedidos_doca")
        .update(payloadPedido as any)
        .eq("id", pedidoDocaId);
      if (errUpdate) throw new Error(errUpdate.message);
    }

    pedidosProcessados += 1;

    // Persiste TODOS os separadores distintos encontrados para o pedido.
    const separadoresUnicos = new Map<string, { cd: number; nm: string }>();
    for (const linha of linhas) {
      if (linha.cd_funcionario) {
        separadoresUnicos.set(String(linha.cd_funcionario), {
          cd: linha.cd_funcionario,
          nm: linha.nm_funcionario ?? "",
        });
      }
    }

    for (const sep of separadoresUnicos.values()) {
      const { data: jaExiste } = await supabase
        .from("doca_pedido_separadores")
        .select("id")
        .eq("pedido_doca_id", pedidoDocaId)
        .eq("cd_funcionario", sep.cd)
        .maybeSingle();
      if (!jaExiste) {
        const { error: errSep } = await supabase.from("doca_pedido_separadores").insert({
          pedido_doca_id: pedidoDocaId,
          cd_funcionario: sep.cd,
          nm_funcionario: sep.nm,
        } as any);
        if (errSep) throw new Error(errSep.message);
        separadoresPersistidos += 1;
      }
    }
  }

  return { pedidosProcessados, separadoresPersistidos };
});

/**
 * "Limpar Dados do Dia": apaga SOMENTE o staging (pedidos_doca_temp).
 * NUNCA apaga pedidos_doca, separadores, auditorias, fotos ou observações.
 */
export const limparTemporario = createServerFn({ method: "POST" }).handler(async () => {
  const { error } = await supabase.from("pedidos_doca_temp").delete().not("id", "is", null);
  if (error) throw new Error(error.message);
  return { ok: true };
});
