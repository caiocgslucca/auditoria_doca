import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { calcularDif, calcularPercentualDif, calcularStatus, calcularQtdeContar } from "./rules";

export interface ConferenteSnapshot {
  userId: string;
  matricula: string;
  nome: string;
}

/**
 * Inicia uma auditoria (ou reauditoria) para um pedido.
 * NUNCA sobrescreve auditoria anterior: cada chamada cria uma NOVA linha
 * em doca_auditorias, preservando o historico completo (reauditoria).
 * A auditoria mais recente iniciada vira a "atual" (is_current), e as
 * anteriores sao marcadas como is_current = false, sem perder dados.
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

    const qtdeContar = calcularQtdeContar({
      cd_classe: pedido.cd_classe,
      qt_produto: pedido.qt_produto,
      qt_separado: pedido.qt_separado,
      qt_cancelado: pedido.qt_cancelado,
      qtd_pendente: null,
      nu_contenedor: pedido.nu_contenedor,
    });

    // Marca todas as auditorias anteriores deste pedido como "nao atuais",
    // mas preserva integralmente o historico (nenhuma linha e apagada).
    await supabase
      .from("doca_auditorias")
      .update({ is_current: false } as any)
      .eq("pedido_doca_id", pedido.id)
      .eq("is_current", true);

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
        is_current: true,
      } as any)
      .select("*")
      .single();
    if (errInsert) throw new Error(errInsert.message);

    await supabase
      .from("pedidos_doca")
      .update({ auditoria_atual_id: auditoria.id, status_atual: "em_andamento" } as any)
      .eq("id", pedido.id);

    return auditoria;
  });

/**
 * Finaliza a auditoria: calcula dif/%dif/status e persiste data/hora bipado
 * (data_hora_finalizacao). Tambem reflete o status no pedido operacional
 * (pedidos_doca.status_atual), que sempre representa a ULTIMA auditoria
 * concluida.
 */
export const finalizarAuditoria = createServerFn({ method: "POST" })
  .validator((input: { auditoriaId: string; qtdeContada: number; notaFiscal?: string | null }) => input)
  .handler(async ({ data }) => {
    const { data: auditoria, error: errBusca } = await supabase
      .from("doca_auditorias")
      .select("qtde_contar, pedido_doca_id")
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

    await supabase
      .from("pedidos_doca")
      .update({ status_atual: status } as any)
      .eq("id", auditoria.pedido_doca_id);

    return atualizado;
  });

/**
 * Edicao pontual de uma auditoria ja existente (modal "Editar" do
 * Acompanhamento). Recalcula dif/%dif/status com a MESMA regra central.
 * Isso NAO cria uma nova auditoria (nao e reauditoria) nem apaga historico.
 */
export const editarAuditoria = createServerFn({ method: "POST" })
  .validator(
    (input: {
      auditoriaId: string;
      qtdeContada: number;
      notaFiscal?: string | null;
      rota?: string | null;
      classe?: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { data: auditoria, error: errBusca } = await supabase
      .from("doca_auditorias")
      .select("qtde_contar, pedido_doca_id, is_current")
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
        ...(data.rota !== undefined ? { rota: data.rota } : {}),
        ...(data.classe !== undefined ? { classe: data.classe } : {}),
      } as any)
      .eq("id", data.auditoriaId)
      .select("*")
      .single();
    if (errUpdate) throw new Error(errUpdate.message);

    if (auditoria.is_current) {
      await supabase
        .from("pedidos_doca")
        .update({ status_atual: status } as any)
        .eq("id", auditoria.pedido_doca_id);
    }

    return atualizado;
  });

/**
 * Registra uma foto da auditoria. O arquivo ja deve ter sido enviado ao
 * Supabase Storage (bucket inventario-doca-fotos); aqui so persistimos a
 * referencia (path), nunca base64.
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
 * Adiciona uma observacao ao historico (imutavel - nunca substitui
 * observacoes anteriores da mesma auditoria).
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
 * Lista as fotos de uma auditoria com URL assinada (Storage privado),
 * usada pelos modais de fotos do Acompanhamento/Consulta/Coletor.
 */
export const listarFotosAuditoria = createServerFn({ method: "GET" })
  .validator((input: { auditoriaId: string }) => input)
  .handler(async ({ data }) => {
    const { data: fotos, error } = await supabase
      .from("doca_auditoria_fotos")
      .select("id, storage_path, nome_arquivo, tipo, created_at")
      .eq("auditoria_id", data.auditoriaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const comUrl = await Promise.all(
      (fotos ?? []).map(async (f: any) => {
        const { data: signed } = await supabase.storage
          .from("inventario-doca-fotos")
          .createSignedUrl(f.storage_path, 60 * 60);
        return { ...f, url: signed?.signedUrl ?? null };
      }),
    );
    return comUrl;
  });

/**
 * Lista o historico de observacoes de uma auditoria (ordem cronologica).
 */
export const listarObservacoesAuditoria = createServerFn({ method: "GET" })
  .validator((input: { auditoriaId: string }) => input)
  .handler(async ({ data }) => {
    const { data: obs, error } = await supabase
      .from("doca_auditoria_observacoes")
      .select("id, observacao, matricula, nome, created_at")
      .eq("auditoria_id", data.auditoriaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return obs ?? [];
  });

/**
 * Consulta por Rota, Pedido ou Nota Fiscal (somente leitura) - usada pela
 * tela CONSULTA do Coletor. Qualquer um dos tres criterios, isoladamente,
 * ja e suficiente.
 */
export const consultarPedidoDoca = createServerFn({ method: "GET" })
  .validator((input: { rota?: string; pedido?: string; notaFiscal?: string }) => input)
  .handler(async ({ data }) => {
    let query = supabase
      .from("doca_auditorias")
      .select("*")
      .eq("is_current", true)
      .is("deleted_at", null)
      .order("data_hora_inicio", { ascending: false });
    if (data.pedido) query = query.eq("pedido", data.pedido);
    if (data.rota) query = query.eq("rota", data.rota);
    if (data.notaFiscal) query = query.eq("nota_fiscal", data.notaFiscal);

    const { data: resultado, error } = await query;
    if (error) throw new Error(error.message);
    return resultado ?? [];
  });

/**
 * Historico completo de auditorias de um pedido (todas as reauditorias),
 * mais recente primeiro. Usado pelo modal de livro (Observacoes/Historico)
 * no Acompanhamento.
 */
export const historicoAuditoriasPedido = createServerFn({ method: "GET" })
  .validator((input: { pedidoDocaId: string }) => input)
  .handler(async ({ data }) => {
    const { data: historico, error } = await supabase
      .from("doca_auditorias")
      .select("*")
      .eq("pedido_doca_id", data.pedidoDocaId)
      .is("deleted_at", null)
      .order("data_hora_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return historico ?? [];
  });

/**
 * Exclusao LOGICA (soft delete) com modal de confirmacao no frontend (acao
 * disparada so apos confirmar). NUNCA apaga fisicamente fotos/observacoes
 * (evita referencias quebradas / orfas) e, ao remover a auditoria atual,
 * promove a auditoria concluida anterior (se houver) como a nova
 * "is_current", mantendo pedidos_doca.status_atual coerente.
 */
export const excluirAuditoria = createServerFn({ method: "POST" })
  .validator((input: { auditoriaId: string }) => input)
  .handler(async ({ data }) => {
    const { data: auditoria, error: errBusca } = await supabase
      .from("doca_auditorias")
      .select("id, pedido_doca_id, is_current")
      .eq("id", data.auditoriaId)
      .single();
    if (errBusca) throw new Error(errBusca.message);

    const { error } = await supabase
      .from("doca_auditorias")
      .update({ deleted_at: new Date().toISOString(), is_current: false } as any)
      .eq("id", data.auditoriaId);
    if (error) throw new Error(error.message);

    if (auditoria.is_current) {
      const { data: anterior } = await supabase
        .from("doca_auditorias")
        .select("id, status")
        .eq("pedido_doca_id", auditoria.pedido_doca_id)
        .is("deleted_at", null)
        .order("data_hora_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anterior) {
        await supabase.from("doca_auditorias").update({ is_current: true } as any).eq("id", anterior.id);
        await supabase
          .from("pedidos_doca")
          .update({ auditoria_atual_id: anterior.id, status_atual: anterior.status } as any)
          .eq("id", auditoria.pedido_doca_id);
      } else {
        await supabase
          .from("pedidos_doca")
          .update({ auditoria_atual_id: null, status_atual: "pendente" } as any)
          .eq("id", auditoria.pedido_doca_id);
      }
    }

    return { ok: true };
  });
