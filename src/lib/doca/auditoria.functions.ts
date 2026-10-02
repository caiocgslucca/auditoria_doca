import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { calcularDif, calcularPercentualDif, calcularStatus } from "./rules";

export interface ConferenteSnapshot {
  userId: string;
  matricula: string;
  nome: string;
}

/**
 * Inicia uma auditoria (ou reauditoria) para um pedido.
 * NUNCA sobrescreve auditoria anterior: cada chamada cria uma NOVA linha
 * em doca_auditorias, preservando o histórico completo (reauditoria).
 */
export const iniciarAuditoria = createServerFn({ method: "POST" })
  .validator((input: { pedidoDocaId: string; conferente: ConferenteSnapshot }) => input)
  .handler(async ({ data }) => {
    const { data: pedido, error: errPedido } = await supabase
      .from("pedidos_doca")
      .select("id, nu_pedido_origem, nu_doc_erp, cd_rota, cd_classe, qt_produto, qt_separado, qt_cancelado, nu_contenedor")
      .eq("id", data.pedidoDocaId)
      .single();
    if (errPedido) throw new Error(errPedido.message);

    const { calcularQtdeContar } = await import("./rules");
    const qtdeContar = calcularQtdeContar({
      cd_classe: pedido.cd_classe,
      qt_produto: pedido.qt_produto,
      qt_separado: pedido.qt_separado,
      qt_cancelado: pedido.qt_cancelado,
      qtd_pendente: null,
      nu_contenedor: pedido.nu_contenedor,
    });

    const { data: auditoria, error: errInsert } = await supabase
      .from("doca_auditorias")
      .insert({
        pedido_doca_id: pedido.id,
        rota: pedido.cd_rota ? String(pedido.cd_rota) : null,
        pedido: pedido.nu_pedido_origem,
        nota_fiscal: null,
        classe: pedido.cd_classe,
        qtde_contar: qtdeContar,
        qtde_contada: null,
        dif: null,
        percentual_dif: null,
        status: "pendente",
        user_id_conferente: data.conferente.userId,
        matricula_conferente: data.conferente.matricula,
        nome_conferente: data.conferente.nome,
        data_hora_inicio: new Date().toISOString(),
        data_hora_finalizacao: null,
      } as any)
      .select("*")
      .single();
    if (errInsert) throw new Error(errInsert.message);

    return auditoria;
  });

/**
 * Finaliza a auditoria: calcula dif/%dif/status e persiste data/hora bipado
 * (data_hora_finalizacao). Tudo fica salvo no banco — nada depende do
 * frontend para reconstruir o histórico depois.
 */
export const finalizarAuditoria = createServerFn({ method: "POST" })
  .validator((input: { auditoriaId: string; qtdeContada: number; notaFiscal?: string | null }) => input)
  .handler(async ({ data }) => {
    const { data: auditoria, error: errBusca } = await supabase
      .from("doca_auditorias")
      .select("qtde_contar")
      .eq("id", data.auditoriaId)
      .single();
    if (errBusca) throw new Error(errBusca.message);

    const dif = calcularDif(auditoria.qtde_contar, data.qtdeContada);
    const percentualDif = calcularPercentualDif(auditoria.qtde_contar, data.qtdeContada);
    const status = calcularStatus(auditoria.qtde_contar, data.qtdeContada);

    const { data: atualizado, error: errUpdate } = await supabase
      .from("doca_auditorias")
      .update({
        qtde_contada: data.qtdeContada,
        dif,
        percentual_dif: percentualDif,
        status,
        nota_fiscal: data.notaFiscal ?? null,
        data_hora_finalizacao: new Date().toISOString(),
      } as any)
      .eq("id", data.auditoriaId)
      .select("*")
      .single();
    if (errUpdate) throw new Error(errUpdate.message);

    return atualizado;
  });

/**
 * Registra uma foto da auditoria. O arquivo já deve ter sido enviado ao
 * Supabase Storage (bucket inventario-doca-fotos); aqui só persistimos a
 * referência (path), nunca base64.
 */
export const registrarFotoAuditoria = createServerFn({ method: "POST" })
  .validator(
    (input: {
      auditoriaId: string;
      storagePath: string;
      nomeArquivo: string;
      tipo: string;
      createdBy: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { data: foto, error } = await supabase
      .from("doca_auditoria_fotos")
      .insert({
        auditoria_id: data.auditoriaId,
        storage_path: data.storagePath,
        nome_arquivo: data.nomeArquivo,
        tipo: data.tipo,
        created_by: data.createdBy,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return foto;
  });

/**
 * Adiciona uma observação ao histórico (imutável — nunca substitui
 * observações anteriores da mesma auditoria).
 */
export const adicionarObservacaoAuditoria = createServerFn({ method: "POST" })
  .validator(
    (input: { auditoriaId: string; texto: string; userId: string; matricula: string; nome: string }) => input,
  )
  .handler(async ({ data }) => {
    const { data: obs, error } = await supabase
      .from("doca_auditoria_observacoes")
      .insert({
        auditoria_id: data.auditoriaId,
        observacao: data.texto,
        user_id: data.userId,
        matricula: data.matricula,
        nome: data.nome,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return obs;
  });

/**
 * Consulta por Rota, Pedido ou Nota Fiscal (somente leitura) — usada pela
 * tela CONSULTA do Coletor. Qualquer um dos três critérios, isoladamente,
 * já é suficiente.
 */
export const consultarPedidoDoca = createServerFn({ method: "GET" })
  .validator((input: { rota?: string; pedido?: string; notaFiscal?: string }) => input)
  .handler(async ({ data }) => {
    let query = supabase.from("doca_auditorias").select("*").order("data_hora_inicio", { ascending: false });
    if (data.pedido) query = query.eq("pedido", data.pedido);
    if (data.rota) query = query.eq("rota", data.rota);
    if (data.notaFiscal) query = query.eq("nota_fiscal", data.notaFiscal);

    const { data: resultado, error } = await query;
    if (error) throw new Error(error.message);
    return resultado ?? [];
  });

/**
 * Exclusão com modal de confirmação no frontend (ação disparada só após
 * confirmar). Remove fotos e observações relacionadas antes, para não
 * deixar registros órfãos (sem FK ON DELETE CASCADE assumida às cegas).
 */
export const excluirAuditoria = createServerFn({ method: "POST" })
  .validator((input: { auditoriaId: string }) => input)
  .handler(async ({ data }) => {
    await supabase.from("doca_auditoria_fotos").delete().eq("auditoria_id", data.auditoriaId);
    await supabase.from("doca_auditoria_observacoes").delete().eq("auditoria_id", data.auditoriaId);
    const { error } = await supabase.from("doca_auditorias").delete().eq("id", data.auditoriaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
