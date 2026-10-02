import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, BookOpen, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatarDif,
  formatarPercentualDif,
  formatarMatriculaNome,
  labelStatus,
} from "@/lib/doca/rules";
import { excluirAuditoria } from "@/lib/doca/auditoria.functions";
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
  const [linhas, setLinhas] = useState<LinhaAuditoria[] | null>(null);
  const [separadoresPorPedido, setSeparadoresPorPedido] = useState<Record<string, SeparadorLinha[]>>({});
  const [fotosPorAuditoria, setFotosPorAuditoria] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<LinhaAuditoria | null>(null);

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
    }
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("doca_acompanhamento")
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditorias" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditoria_fotos" }, () => carregar())
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
                        className={
                          "rounded-md p-1 " + (temFoto ? "text-primary hover:bg-primary/10" : "text-muted-foreground/50")
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
                      <button type="button" title="Observações" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <BookOpen className="size-4" />
                      </button>
                      <button type="button" title="Editar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
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
              Esta ação poderá remover informações relacionadas ao registro.
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
    </div>
  );
}
