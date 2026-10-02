import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, BookOpen, Pencil, Trash2, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatarDif,
  formatarPercentualDif,
  formatarMatriculaNome,
  labelStatus,
} from "@/lib/doca/rules";
import {
  excluirAuditoria,
  editarAuditoria,
  listarFotosAuditoria,
  listarObservacoesAuditoria,
  historicoAuditoriasPedido,
  adicionarObservacaoAuditoria,
} from "@/lib/doca/auditoria.functions";
import { useAuthUser } from "@/lib/useAuthUser";
import { toast } from "sonner";

export const Route = createFileRoute("/doca/acompanhamento")({
  head: () => ({ meta: [{ title: "Acompanhamento — Inventário Doca" }] }),
  component: AcompanhamentoPage,
});

interface LinhaAuditoria {
  id: string;
  pedido_doca_id: string;
  rota: string | null;
  pedido: string;
  nota_fiscal: string | null;
  classe: string | null;
  qtde_contar: number;
  qtde_contada: number | null;
  dif: number | null;
  percentual_dif: number | null;
  status: string;
  matricula_conferente: string | null;
  nome_conferente: string | null;
  data_hora_finalizacao: string | null;
}

interface SeparadorLinha {
  pedido_doca_id: string;
  cd_funcionario: number;
  nm_funcionario: string;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function AcompanhamentoPage() {
  const { user } = useAuthUser();
  const [linhas, setLinhas] = useState<LinhaAuditoria[] | null>(null);
  const [separadoresPorPedido, setSeparadoresPorPedido] = useState<Record<string, SeparadorLinha[]>>({});
  const [fotosPorAuditoria, setFotosPorAuditoria] = useState<Record<string, number>>({});
  const [obsPorAuditoria, setObsPorAuditoria] = useState<Record<string, { total: number; ultima: string | null }>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<LinhaAuditoria | null>(null);
  const [editando, setEditando] = useState<LinhaAuditoria | null>(null);
  const [observando, setObservando] = useState<LinhaAuditoria | null>(null);
  const [vendoFotos, setVendoFotos] = useState<LinhaAuditoria | null>(null);

  async function carregar() {
    setErro(null);
    const { data, error } = await supabase
      .from("doca_auditorias")
      .select(
        "id, pedido_doca_id, rota, pedido, nota_fiscal, classe, qtde_contar, qtde_contada, dif, percentual_dif, status, matricula_conferente, nome_conferente, data_hora_finalizacao",
      )
      .is("deleted_at", null)
      .eq("is_current", true)
      .order("data_hora_finalizacao", { ascending: false, nullsFirst: false });

    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    setLinhas((data ?? []) as LinhaAuditoria[]);

    const pedidoDocaIds = Array.from(new Set((data ?? []).map((l: any) => l.pedido_doca_id)));
    if (pedidoDocaIds.length) {
      const { data: seps } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoDocaIds);
      const agrupado: Record<string, SeparadorLinha[]> = {};
      for (const s of seps ?? []) {
        const key = (s as any).pedido_doca_id;
        if (!agrupado[key]) agrupado[key] = [];
        agrupado[key].push(s as any);
      }
      setSeparadoresPorPedido(agrupado);
    }

    const auditoriaIds = (data ?? []).map((l: any) => l.id);
    if (auditoriaIds.length) {
      const { data: fotos } = await supabase
        .from("doca_auditoria_fotos")
        .select("auditoria_id")
        .in("auditoria_id", auditoriaIds);
      const contagem: Record<string, number> = {};
      for (const f of fotos ?? []) {
        const key = (f as any).auditoria_id;
        contagem[key] = (contagem[key] ?? 0) + 1;
      }
      setFotosPorAuditoria(contagem);

      const { data: obs } = await supabase
        .from("doca_auditoria_observacoes")
        .select("auditoria_id, observacao, created_at")
        .in("auditoria_id", auditoriaIds)
        .order("created_at", { ascending: true });
      const resumo: Record<string, { total: number; ultima: string | null }> = {};
      for (const o of obs ?? []) {
        const key = (o as any).auditoria_id;
        if (!resumo[key]) resumo[key] = { total: 0, ultima: null };
        resumo[key].total += 1;
        resumo[key].ultima = (o as any).observacao;
      }
      setObsPorAuditoria(resumo);
    }
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("doca_acompanhamento")
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditorias" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditoria_fotos" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditoria_observacoes" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await excluirAuditoria({ data: { auditoriaId: excluindo.id } } as any);
      toast.success("Registro excluído.");
      setExcluindo(null);
      carregar();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  }

  const linhasOrdenadas = useMemo(() => linhas ?? [], [linhas]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground">Auditorias de inventário de doca em tempo real.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Data/Hora Bipado</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Rota</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Pedido</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Nota Fiscal</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Classe</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Qtde Contar</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Qtde Contada</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Dif</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">% Dif</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Conferente</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Separador</th>
              <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas === null && !erro && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                  Carregando auditorias...
                </td>
              </tr>
            )}
            {erro && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-destructive">{erro}</td>
              </tr>
            )}
            {linhas !== null && linhas.length === 0 && !erro && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {linhasOrdenadas.map((l) => {
              const temFoto = (fotosPorAuditoria[l.id] ?? 0) > 0;
              const resumoObs = obsPorAuditoria[l.id];
              const separadores = separadoresPorPedido[l.pedido_doca_id] ?? [];
              const primeiroSeparador = separadores[0];
              const divergente = l.status === "finalizado_com_divergencia";
              return (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{formatarDataHora(l.data_hora_finalizacao)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.rota ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      {l.pedido}
                      <button
                        type="button"
                        title={temFoto ? "Ver fotos da auditoria" : "Sem fotos registradas"}
                        onClick={() => setVendoFotos(l)}
                        className={
                          "rounded-md p-1 " + (temFoto ? "text-primary hover:bg-primary/10" : "text-muted-foreground/50 hover:bg-muted")
                        }
                      >
                        <Camera className="size-4" />
                      </button>
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nota_fiscal ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.classe ?? "-"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qtde_contar}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qtde_contada ?? "-"}</td>
                  <td className={"px-3 py-2 text-right whitespace-nowrap font-medium " + (divergente ? "text-destructive" : "text-foreground")}>
                    {formatarDif(l.dif)}
                  </td>
                  <td className={"px-3 py-2 text-right whitespace-nowrap font-medium " + (divergente ? "text-destructive" : "text-foreground")}>
                    {formatarPercentualDif(l.percentual_dif)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">
                    {formatarMatriculaNome(l.matricula_conferente, l.nome_conferente)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">
                    {primeiroSeparador
                      ? formatarMatriculaNome(String(primeiroSeparador.cd_funcionario), primeiroSeparador.nm_funcionario)
                      : "-"}
                    {separadores.length > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">+{separadores.length - 1}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        title={resumoObs?.ultima ? `Última observação: ${resumoObs.ultima}` : "Sem observações registradas"}
                        onClick={() => setObservando(l)}
                        className={
                          "rounded-md p-1.5 " +
                          (resumoObs?.total
                            ? "text-primary hover:bg-primary/10"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground")
                        }
                      >
                        <BookOpen className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => setEditando(l)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setExcluindo(l)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card border border-border p-5 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Excluir registro?</h2>
            <p className="text-sm text-muted-foreground">
              Pedido: {excluindo.pedido}
              <br />
              Rota: {excluindo.rota ?? "-"}
              <br />
              O registro será removido do Acompanhamento. Fotos e observações permanecem preservadas no histórico, sem ficar órfãs.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setExcluindo(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <ModalEditar
          linha={editando}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      {observando && (
        <ModalObservacoesHistorico
          linha={observando}
          onClose={() => setObservando(null)}
          userMatricula={user?.matricula ?? null}
          userNome={user?.nome ?? null}
          userId={user?.userId ?? null}
          onAtualizado={carregar}
        />
      )}

      {vendoFotos && (
        <ModalFotos linha={vendoFotos} onClose={() => setVendoFotos(null)} />
      )}
    </div>
  );
}

function ModalEditar({
  linha,
  onClose,
  onSalvo,
}: {
  linha: LinhaAuditoria;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [qtdeContada, setQtdeContada] = useState(linha.qtde_contada !== null ? String(linha.qtde_contada) : "");
  const [notaFiscal, setNotaFiscal] = useState(linha.nota_fiscal ?? "");
  const [rota, setRota] = useState(linha.rota ?? "");
  const [classe, setClasse] = useState(linha.classe ?? "");
const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    const qtd = Number(qtdeContada);
    if (!qtdeContada || isNaN(qtd) || qtd < 0) {
      toast.error("Informe uma Qtde Contada válida.");
      return;
    }
    setSalvando(true);
    try {
      await editarAuditoria({
        data: {
          auditoriaId: linha.id,
          qtdeContada: qtd,
          notaFiscal: notaFiscal.trim() || null,
          rota: rota.trim() || null,
          classe: classe.trim() || null,
        },
      } as any);
      toast.success("Registro atualizado.");
      onSalvo();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Editar Auditoria — Pedido {linha.pedido}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Rota</label>
            <input
              value={rota}
              onChange={(e) => setRota(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Classe</label>
            <input
              value={classe}
              onChange={(e) => setClasse(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Nota Fiscal</label>
          <input
            value={notaFiscal}
            onChange={(e) => setNotaFiscal(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Qtde Contar</label>
          <input
            disabled
            value={linha.qtde_contar}
            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Qtde Contada *</label>
          <input
            type="number"
            value={qtdeContada}
            onChange={(e) => setQtdeContada(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface HistoricoItem {
  id: string;
  data_hora_inicio: string;
  data_hora_finalizacao: string | null;
  qtde_contada: number | null;
  dif: number | null;
  status: string;
  matricula_conferente: string | null;
  nome_conferente: string | null;
}

interface ObservacaoItem {
  id: string;
  observacao: string;
  matricula: string | null;
  nome: string | null;
  created_at: string;
}

function ModalObservacoesHistorico({
  linha,
  onClose,
  userMatricula,
  userNome,
  userId,
  onAtualizado,
}: {
  linha: LinhaAuditoria;
  onClose: () => void;
  userMatricula: string | null;
  userNome: string | null;
  userId: string | null;
  onAtualizado: () => void;
}) {
  const [historico, setHistorico] = useState<HistoricoItem[] | null>(null);
  const [observacoes, setObservacoes] = useState<ObservacaoItem[] | null>(null);
  const [novaObs, setNovaObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    try {
      const [hist, obs] = await Promise.all([
        historicoAuditoriasPedido({ data: { pedidoDocaId: linha.pedido_doca_id } } as any),
        listarObservacoesAuditoria({ data: { auditoriaId: linha.id } } as any),
      ]);
      setHistorico(hist as any);
      setObservacoes(obs as any);
    } catch {
      setHistorico([]);
      setObservacoes([]);
    }
  }

  useEffect(() => {
    carregar();
  }, [linha.id]);

  async function enviarObservacao() {
    if (!novaObs.trim() || !userId || !userMatricula || !userNome) return;
    setEnviando(true);
    try {
      await adicionarObservacaoAuditoria({
        data: { auditoriaId: linha.id, texto: novaObs.trim(), userId, matricula: userMatricula, nome: userNome },
      } as any);
      setNovaObs("");
      await carregar();
      onAtualizado();
    } catch (e: any) {
      toast.error("Erro ao registrar observação: " + e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg bg-card border border-border p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Observações e Histórico — Pedido {linha.pedido}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Histórico de auditorias (reauditoria)</h3>
          {historico === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {historico !== null && historico.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma auditoria registrada.</p>
          )}
          <ul className="space-y-2">
            {historico?.map((h) => (
              <li key={h.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">{labelStatus(h.status as any)}</span>
                  <span className="text-muted-foreground">{formatarDataHora(h.data_hora_finalizacao)}</span>
                </div>
                <p className="text-muted-foreground">
                  Contada: {h.qtde_contada ?? "-"} · Dif: {formatarDif(h.dif)} · Conferente:{" "}
                  {formatarMatriculaNome(h.matricula_conferente, h.nome_conferente)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Observações (histórico imutável)</h3>
          {observacoes === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {observacoes !== null && observacoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma observação registrada para esta auditoria.</p>
          )}
          <ul className="space-y-2">
            {observacoes?.map((o) => (
              <li key={o.id} className="rounded-md bg-muted/40 p-3 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatarMatriculaNome(o.matricula, o.nome)}</span>
                  <span>{formatarDataHora(o.created_at)}</span>
                </div>
                <p className="text-foreground mt-1">{o.observacao}</p>
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-2">
            <input
              value={novaObs}
              onChange={(e) => setNovaObs(e.target.value)}
              placeholder="Adicionar nova observação..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              onClick={enviarObservacao}
              disabled={enviando || !novaObs.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="size-4" />
              Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FotoItem {
  id: string;
  url: string | null;
  nome_arquivo: string;
  created_at: string;
}

function ModalFotos({ linha, onClose }: { linha: LinhaAuditoria; onClose: () => void }) {
  const [fotos, setFotos] = useState<FotoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarFotosAuditoria({ data: { auditoriaId: linha.id } } as any)
      .then((r: any) => setFotos(r))
      .catch(() => setErro("Não foi possível carregar as fotos."));
  }, [linha.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Fotos da Auditoria — Pedido {linha.pedido}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {fotos === null && !erro && <p className="text-sm text-muted-foreground">Carregando fotos...</p>}
        {fotos !== null && fotos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma foto registrada para esta auditoria.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {fotos?.map((f) =>
            f.url ? (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-border">
                <img src={f.url} alt={`Foto do fardo - pedido ${linha.pedido}`} className="w-full h-36 object-cover" />
              </a>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
