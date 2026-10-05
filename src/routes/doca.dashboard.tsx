import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { labelStatus } from "@/lib/doca/rules";

export const Route = createFileRoute("/doca/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Inventário Doca" }] }),
  component: DashboardPage,
});

interface AuditoriaResumo {
  id: string;
  classe: string | null;
  rota: string | null;
  status: string;
  matricula_conferente: string | null;
  nome_conferente: string | null;
  pedido_doca_id: string;
  data_hora_finalizacao: string | null;
  qtde_contar: number;
  qtde_contada: number | null;
}

interface SeparadorResumo {
  pedido_doca_id: string;
  cd_funcionario: number;
  nm_funcionario: string;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Dashboard consome doca_auditorias (dados reais persistidos, nunca fake):
// cards TOTAL AUDITADO / SEM DIVERGÊNCIA / COM DIVERGÊNCIA / ACURACIDADE,
// filtros Período/Classe/Rota/Conferente/Separador, e análises por Status,
// Classe, Conferente, Separador e Divergências por Classe. PDF respeita os
// mesmos filtros aplicados na tela.
function DashboardPage() {
  const [auditorias, setAuditorias] = useState<AuditoriaResumo[] | null>(null);
  const [separadores, setSeparadores] = useState<SeparadorResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroClasse, setFiltroClasse] = useState("");
  const [filtroRota, setFiltroRota] = useState("");
  const [filtroConferente, setFiltroConferente] = useState("");
  const [filtroSeparador, setFiltroSeparador] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  async function carregar() {
    setErro(null);
    let query = supabase
      .from("doca_auditorias")
      .select("id, classe, rota, status, matricula_conferente, nome_conferente, pedido_doca_id, data_hora_finalizacao, qtde_contar, qtde_contada")
      .is("deleted_at", null)
      .eq("is_current", true)
      .neq("status", "pendente");

    if (filtroClasse) query = query.eq("classe", filtroClasse);
    if (filtroRota) query = query.eq("rota", filtroRota);
    if (filtroConferente) query = query.ilike("nome_conferente", `%${filtroConferente}%`);
    if (filtroStatus) query = query.eq("status", filtroStatus);
    if (filtroDe) query = query.gte("data_hora_finalizacao", new Date(filtroDe + "T00:00:00").toISOString());
    if (filtroAte) query = query.lte("data_hora_finalizacao", new Date(filtroAte + "T23:59:59").toISOString());

    const { data, error } = await query;
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    let resultado = (data ?? []) as AuditoriaResumo[];

    const pedidoIds = Array.from(new Set(resultado.map((a) => a.pedido_doca_id)));
    let seps: SeparadorResumo[] = [];
    if (pedidoIds.length) {
      const { data: sepsData } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoIds);
      seps = (sepsData ?? []) as SeparadorResumo[];
    }

    if (filtroSeparador) {
      const termo = filtroSeparador.toLowerCase();
      const pedidosComSeparador = new Set(
        seps
          .filter((s) => s.nm_funcionario.toLowerCase().includes(termo) || String(s.cd_funcionario).includes(termo))
          .map((s) => s.pedido_doca_id),
      );
      resultado = resultado.filter((a) => pedidosComSeparador.has(a.pedido_doca_id));
    }

    setAuditorias(resultado);
    setSeparadores(seps);
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
  }, [filtroDe, filtroAte, filtroClasse, filtroRota, filtroConferente, filtroSeparador, filtroStatus]);

  const totalAuditado = auditorias?.length ?? 0;
  const semDivergencia = auditorias?.filter((a) => a.status === "finalizado_sem_divergencia").length ?? 0;
  const comDivergencia = auditorias?.filter((a) => a.status === "finalizado_com_divergencia").length ?? 0;
  const acuracidade = totalAuditado > 0 ? (semDivergencia / totalAuditado) * 100 : 0;
  // Soma real das diferencas absolutas (itens), calculada a partir dos
  // dados persistidos de qtde_contar/qtde_contada - nao e um valor fixo.
  const totalItensDivergentes = useMemo(() => {
    return (auditorias ?? []).reduce((acc, a) => {
      if (a.qtde_contada === null || a.qtde_contada === undefined) return acc;
      return acc + Math.abs(a.qtde_contada - a.qtde_contar);
    }, 0);
  }, [auditorias]);

  const porClasse = useMemo(() => {
    const mapa = new Map<string, { total: number; divergente: number }>();
    for (const a of auditorias ?? []) {
      const classe = a.classe ?? "-";
      if (!mapa.has(classe)) mapa.set(classe, { total: 0, divergente: 0 });
      const item = mapa.get(classe)!;
      item.total += 1;
      if (a.status === "finalizado_com_divergencia") item.divergente += 1;
    }
    return Array.from(mapa.entries()).map(([classe, v]) => ({ classe, ...v }));
  }, [auditorias]);

  const porStatus = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of auditorias ?? []) {
      mapa.set(a.status, (mapa.get(a.status) ?? 0) + 1);
    }
    return Array.from(mapa.entries()).map(([status, qtd]) => ({ status, qtd }));
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

  function gerarPdf() {
    const agora = new Date();
    const periodo = `${filtroDe || "início"} até ${filtroAte || "hoje"}`;
    const filtrosAtivos = [
      filtroClasse && `Classe: ${filtroClasse}`,
      filtroRota && `Rota: ${filtroRota}`,
      filtroConferente && `Conferente: ${filtroConferente}`,
      filtroSeparador && `Separador: ${filtroSeparador}`,
    ].filter(Boolean).join(" | ") || "Nenhum filtro adicional";

    const linhasClasse = porClasse
      .map((c) => `<tr><td>${c.classe}</td><td style="text-align:right">${c.total}</td><td style="text-align:right">${c.divergente}</td></tr>`)
      .join("");
    const linhasConferente = porConferente
      .map(
        (c) =>
          `<tr><td>${c.matricula} - ${c.nome}</td><td style="text-align:right">${c.total}</td><td style="text-align:right">${c.total > 0 ? ((c.semDvg / c.total) * 100).toFixed(1) : "0.0"}%</td></tr>`,
      )
      .join("");
    const linhasSeparador = porSeparador
      .map(
        (s) =>
          `<tr><td>${s.matricula} - ${s.nome}</td><td style="text-align:right">${s.total}</td><td style="text-align:right">${s.total > 0 ? ((s.semDvg / s.total) * 100).toFixed(1) : "0.0"}%</td></tr>`,
      )
      .join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Relatório Dashboard — Inventário Doca</title>
    <style>
      @page { margin: 24mm 16mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; }
      header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 16px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 18px 0 8px; border-left: 4px solid #1a1a1a; padding-left: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
      th { background: #f0f0f0; text-align: left; }
      .cards { display: flex; gap: 10px; margin-bottom: 14px; }
      .card { flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 10px; }
      .card p.label { margin: 0; font-size: 10px; color: #666; text-transform: uppercase; }
      .card p.value { margin: 4px 0 0; font-size: 20px; font-weight: bold; }
      footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 6px; display: flex; justify-content: space-between; }
      .pagenum:after { content: counter(page); }
    </style>
    </head><body>
      <header>
        <h1>Relatório de Indicadores — Inventário Doca</h1>
        <p>Período: ${periodo} &nbsp;|&nbsp; Filtros: ${filtrosAtivos}</p>
        <p>Gerado em ${agora.toLocaleString("pt-BR")}</p>
      </header>

      <div class="cards">
        <div class="card"><p class="label">Total Auditado</p><p class="value">${totalAuditado}</p></div>
        <div class="card"><p class="label">Sem Divergência</p><p class="value">${semDivergencia}</p></div>
        <div class="card"><p class="label">Com Divergência</p><p class="value">${comDivergencia}</p></div>
        <div class="card"><p class="label">Acuracidade</p><p class="value">${acuracidade.toFixed(1)}%</p></div>
      </div>

      <h2>Divergências por Classe</h2>
      <table><thead><tr><th>Classe</th><th style="text-align:right">Total</th><th style="text-align:right">Com Divergência</th></tr></thead><tbody>${linhasClasse || '<tr><td colspan="3">Nenhum registro.</td></tr>'}</tbody></table>

      <h2>Indicador por Conferente</h2>
      <table><thead><tr><th>Matrícula - Nome</th><th style="text-align:right">Total</th><th style="text-align:right">Acuracidade</th></tr></thead><tbody>${linhasConferente || '<tr><td colspan="3">Nenhum registro.</td></tr>'}</tbody></table>

      <h2>Indicador por Separador</h2>
      <table><thead><tr><th>Matrícula - Nome</th><th style="text-align:right">Total</th><th style="text-align:right">Acuracidade</th></tr></thead><tbody>${linhasSeparador || '<tr><td colspan="3">Nenhum registro.</td></tr>'}</tbody></table>

      <footer><span>Inventário Doca — Relatório Confidencial</span><span>Página <span class="pagenum"></span></span></footer>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  if (erro) {
    return <div className="p-6 text-destructive">{erro}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Indicadores consolidados de auditoria do inventário de doca.</p>
        </div>
        <button
          onClick={gerarPdf}
          disabled={auditorias === null}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <FileDown className="size-4" />
          Gerar PDF
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Classe</label>
          <input value={filtroClasse} onChange={(e) => setFiltroClasse(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Rota</label>
          <input value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Conferente</label>
          <input value={filtroConferente} onChange={(e) => setFiltroConferente(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1 col-span-2 md:col-span-1">
          <label className="text-xs text-muted-foreground">Separador</label>
          <input value={filtroSeparador} onChange={(e) => setFiltroSeparador(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            <option value="finalizado_sem_divergencia">Finalizado S/Dvg.</option>
            <option value="finalizado_com_divergencia">Finalizado C/Dvg.</option>
          </select>
        </div>
      </div>

      {auditorias === null ? (
        <div className="p-6 text-muted-foreground">Carregando indicadores...</div>
      ) : (
        <>
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
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">ITENS DIVERGENTES (ABS)</p>
              <p className="text-2xl font-semibold text-destructive mt-1">{totalItensDivergentes}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-3">Distribuição por Status</h2>
              {porStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {porStatus.map((s) => (
                    <li key={s.status} className="flex justify-between text-foreground">
                      <span>{labelStatus(s.status as any)}</span>
                      <span className="font-medium">{s.qtd}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-3">Divergências por Classe</h2>
              {porClasse.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left py-1">Classe</th><th className="text-right py-1">Total</th><th className="text-right py-1">C/ Dvg.</th></tr>
                  </thead>
                  <tbody>
                    {porClasse.map((c) => (
                      <tr key={c.classe} className="border-t border-border text-foreground">
                        <td className="py-1">{c.classe}</td>
                        <td className="py-1 text-right">{c.total}</td>
                        <td className="py-1 text-right text-destructive">{c.divergente}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
        </>
      )}
    </div>
  );
}
