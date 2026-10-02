import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/doca/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Inventário Doca" }] }),
  component: DashboardPage,
});

interface AuditoriaResumo {
  id: string;
  classe: string | null;
  status: string;
  matricula_conferente: string | null;
  nome_conferente: string | null;
  pedido_doca_id: string;
}

interface SeparadorResumo {
  pedido_doca_id: string;
  cd_funcionario: number;
  nm_funcionario: string;
}

function DashboardPage() {
  const [auditorias, setAuditorias] = useState<AuditoriaResumo[] | null>(null);
  const [separadores, setSeparadores] = useState<SeparadorResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    const { data, error } = await supabase
      .from("doca_auditorias")
      .select("id, classe, status, matricula_conferente, nome_conferente, pedido_doca_id")
      .is("deleted_at", null)
      .eq("is_current", true)
      .neq("status", "pendente");
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    setAuditorias((data ?? []) as AuditoriaResumo[]);

    const pedidoIds = Array.from(new Set((data ?? []).map((a: any) => a.pedido_doca_id)));
    if (pedidoIds.length) {
      const { data: seps } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoIds);
      setSeparadores((seps ?? []) as SeparadorResumo[]);
    }
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("doca_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "doca_auditorias" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalAuditado = auditorias?.length ?? 0;
  const semDivergencia = auditorias?.filter((a) => a.status === "finalizado_sem_divergencia").length ?? 0;
  const comDivergencia = auditorias?.filter((a) => a.status === "finalizado_com_divergencia").length ?? 0;
  const acuracidade = totalAuditado > 0 ? (semDivergencia / totalAuditado) * 100 : 0;

  const porClasse = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of auditorias ?? []) {
      const classe = a.classe ?? "-";
      mapa.set(classe, (mapa.get(classe) ?? 0) + 1);
    }
    return Array.from(mapa.entries()).map(([classe, qtd]) => ({ classe, qtd }));
  }, [auditorias]);

  const porConferente = useMemo(() => {
    const mapa = new Map<string, { matricula: string; nome: string; total: number; semDvg: number }>();
    for (const a of auditorias ?? []) {
      if (!a.matricula_conferente) continue;
      const key = a.matricula_conferente;
      if (!mapa.has(key)) {
        mapa.set(key, { matricula: a.matricula_conferente, nome: a.nome_conferente ?? "-", total: 0, semDvg: 0 });
      }
      const item = mapa.get(key)!;
      item.total += 1;
      if (a.status === "finalizado_sem_divergencia") item.semDvg += 1;
    }
    return Array.from(mapa.values());
  }, [auditorias]);

  const porSeparador = useMemo(() => {
    const statusPorPedido = new Map<string, string>();
    for (const a of auditorias ?? []) statusPorPedido.set(a.pedido_doca_id, a.status);

    const mapa = new Map<string, { matricula: string; nome: string; total: number; semDvg: number }>();
    for (const s of separadores) {
      const status = statusPorPedido.get(s.pedido_doca_id);
      if (!status) continue;
      const key = String(s.cd_funcionario);
      if (!mapa.has(key)) {
        mapa.set(key, { matricula: key, nome: s.nm_funcionario, total: 0, semDvg: 0 });
      }
      const item = mapa.get(key)!;
      item.total += 1;
      if (status === "finalizado_sem_divergencia") item.semDvg += 1;
    }
    return Array.from(mapa.values());
  }, [auditorias, separadores]);

  if (erro) {
    return <div className="p-6 text-destructive">{erro}</div>;
  }

  if (auditorias === null) {
    return <div className="p-6 text-muted-foreground">Carregando indicadores...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Indicadores consolidados de auditoria do inventário de doca.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">TOTAL AUDITADO</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{totalAuditado}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">SEM DIVERGÊNCIA</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{semDivergencia}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">COM DIVERGÊNCIA</p>
          <p className="text-2xl font-semibold text-destructive mt-1">{comDivergencia}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">ACURACIDADE</p>
          <p className="text-2xl font-semibold text-primary mt-1">{acuracidade.toFixed(1).replace(".", ",")}%</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-3">Distribuição por Classe</h2>
        {porClasse.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {porClasse.map((c) => (
              <li key={c.classe} className="flex justify-between text-foreground">
                <span>{c.classe}</span>
                <span className="font-medium">{c.qtd}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">Indicador por Conferente</h2>
          {porConferente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Matrícula - Nome</th>
                  <th className="text-right py-1">Total</th>
                  <th className="text-right py-1">Acuracidade</th>
                </tr>
              </thead>
              <tbody>
                {porConferente.map((c) => (
                  <tr key={c.matricula} className="border-t border-border text-foreground">
                    <td className="py-1">{c.matricula} - {c.nome}</td>
                    <td className="py-1 text-right">{c.total}</td>
                    <td className="py-1 text-right">{c.total > 0 ? ((c.semDvg / c.total) * 100).toFixed(1).replace(".", ",") : "0,0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-3">Indicador por Separador</h2>
          {porSeparador.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Matrícula - Nome</th>
                  <th className="text-right py-1">Total</th>
                  <th className="text-right py-1">Acuracidade</th>
                </tr>
              </thead>
              <tbody>
                {porSeparador.map((s) => (
                  <tr key={s.matricula} className="border-t border-border text-foreground">
                    <td className="py-1">{s.matricula} - {s.nome}</td>
                    <td className="py-1 text-right">{s.total}</td>
                    <td className="py-1 text-right">{s.total > 0 ? ((s.semDvg / s.total) * 100).toFixed(1).replace(".", ",") : "0,0"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
