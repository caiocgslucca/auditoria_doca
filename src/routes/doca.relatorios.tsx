import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatarDif, formatarPercentualDif, labelStatus } from "@/lib/doca/rules";

export const Route = createFileRoute("/doca/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Inventário Doca" }] }),
  component: RelatoriosPage,
});

interface LinhaRelatorio {
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
  matricula_conferente: string | null;
  nome_conferente: string | null;
  status: string;
  data_hora_finalizacao: string | null;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Relatórios segue EXATAMENTE o modelo de colunas do Acompanhamento:
// Data/Hora Bipado, Rota, Pedido, NF, Classe, Qtde Contar, Qtde Contada,
// Dif, %Dif, Conferente, Separador, Observação, Fotos, Status — com
// filtros de Período/Rota/Pedido/NF/Classe/Conferente/Separador/Status e
// exportação XLSX que respeita os filtros aplicados.
function RelatoriosPage() {
  const [linhas, setLinhas] = useState<LinhaRelatorio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [separadoresPorPedido, setSeparadoresPorPedido] = useState<Record<string, string>>({});
  const [obsPorAuditoria, setObsPorAuditoria] = useState<Record<string, string>>({});
  const [fotosPorAuditoria, setFotosPorAuditoria] = useState<Record<string, number>>({});

  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroRota, setFiltroRota] = useState("");
  const [filtroPedido, setFiltroPedido] = useState("");
  const [filtroNf, setFiltroNf] = useState("");
  const [filtroClasse, setFiltroClasse] = useState("");
  const [filtroConferente, setFiltroConferente] = useState("");
  const [filtroSeparador, setFiltroSeparador] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [buscaLivre, setBuscaLivre] = useState("");

  async function carregar() {
    setErro(null);
    let query = supabase
      .from("doca_auditorias")
      .select(
        "id, pedido_doca_id, rota, pedido, nota_fiscal, classe, qtde_contar, qtde_contada, dif, percentual_dif, matricula_conferente, nome_conferente, status, data_hora_finalizacao",
      )
      .is("deleted_at", null)
      .eq("is_current", true)
      .order("data_hora_finalizacao", { ascending: false, nullsFirst: false });

    if (filtroRota) query = query.eq("rota", filtroRota);
    if (filtroPedido) query = query.eq("pedido", filtroPedido);
    if (filtroNf) query = query.eq("nota_fiscal", filtroNf);
    if (filtroClasse) query = query.eq("classe", filtroClasse);
    if (filtroConferente) query = query.ilike("nome_conferente", `%${filtroConferente}%`);
    if (filtroStatus) query = query.eq("status", filtroStatus);
    if (filtroDe) query = query.gte("data_hora_finalizacao", new Date(filtroDe + "T00:00:00").toISOString());
    if (filtroAte) query = query.lte("data_hora_finalizacao", new Date(filtroAte + "T23:59:59").toISOString());

    const { data, error } = await query;
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    let resultado = (data ?? []) as LinhaRelatorio[];

    const pedidoIds = Array.from(new Set(resultado.map((l) => l.pedido_doca_id)));
    let mapaSeparadores: Record<string, string> = {};
    let separadoresPorPedidoId: Record<string, { cd_funcionario: number; nm_funcionario: string }[]> = {};
    if (pedidoIds.length) {
      const { data: seps } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoIds);
      for (const s of seps ?? []) {
        const key = (s as any).pedido_doca_id;
        if (!separadoresPorPedidoId[key]) separadoresPorPedidoId[key] = [];
        separadoresPorPedidoId[key].push(s as any);
        if (!mapaSeparadores[key]) mapaSeparadores[key] = `${(s as any).cd_funcionario} - ${(s as any).nm_funcionario}`;
      }
    }

    if (filtroSeparador) {
      const termo = filtroSeparador.toLowerCase();
      resultado = resultado.filter((l) => {
        const seps = separadoresPorPedidoId[l.pedido_doca_id] ?? [];
        return seps.some(
          (s) => s.nm_funcionario.toLowerCase().includes(termo) || String(s.cd_funcionario).includes(termo),
        );
      });
    }

    // Busca livre: aplica filtro adicional em memoria cruzando Rota, Pedido
    // e Nota Fiscal simultaneamente (complementar aos filtros de campo unico).
    if (buscaLivre.trim()) {
      const termo = buscaLivre.trim().toLowerCase();
      resultado = resultado.filter(
        (l) =>
          (l.rota ?? "").toLowerCase().includes(termo) ||
          l.pedido.toLowerCase().includes(termo) ||
          (l.nota_fiscal ?? "").toLowerCase().includes(termo),
      );
    }

    setSeparadoresPorPedido(mapaSeparadores);
    setLinhas(resultado);

    const auditoriaIds = resultado.map((l) => l.id);
    if (auditoriaIds.length) {
      const { data: obs } = await supabase
        .from("doca_auditoria_observacoes")
        .select("auditoria_id, observacao, created_at")
        .in("auditoria_id", auditoriaIds)
        .order("created_at", { ascending: true });
      const mapaObs: Record<string, string> = {};
      for (const o of obs ?? []) {
        mapaObs[(o as any).auditoria_id] = (o as any).observacao;
      }
      setObsPorAuditoria(mapaObs);

      const { data: fotos } = await supabase
        .from("doca_auditoria_fotos")
        .select("auditoria_id")
        .in("auditoria_id", auditoriaIds);
      const mapaFotos: Record<string, number> = {};
      for (const f of fotos ?? []) {
        const key = (f as any).auditoria_id;
        mapaFotos[key] = (mapaFotos[key] ?? 0) + 1;
      }
      setFotosPorAuditoria(mapaFotos);
    } else {
      setObsPorAuditoria({});
      setFotosPorAuditoria({});
    }
  }

  useEffect(() => {
    carregar();
  }, [filtroDe, filtroAte, filtroRota, filtroPedido, filtroNf, filtroClasse, filtroConferente, filtroSeparador, filtroStatus, buscaLivre]);

  function limparFiltros() {
    setFiltroDe("");
    setFiltroAte("");
    setFiltroRota("");
    setFiltroPedido("");
    setFiltroNf("");
    setFiltroClasse("");
    setFiltroConferente("");
    setFiltroSeparador("");
    setFiltroStatus("");
  }

  function exportarXLSX() {
    const linhasExport = (linhas ?? []).map((l) => ({
      "Data/Hora Bipado": formatarDataHora(l.data_hora_finalizacao),
      Rota: l.rota ?? "",
      Pedido: l.pedido,
      "Nota Fiscal": l.nota_fiscal ?? "",
      Classe: l.classe ?? "",
      "Qtde Contar": l.qtde_contar,
      "Qtde Contada": l.qtde_contada ?? "",
      Dif: l.dif ?? "",
      "% Dif": l.percentual_dif ?? "",
      "Matrícula/Nome Conferente": l.matricula_conferente ? `${l.matricula_conferente} - ${l.nome_conferente}` : "",
      "Matrícula/Nome Separador": separadoresPorPedido[l.pedido_doca_id] ?? "",
      Observação: obsPorAuditoria[l.id] ?? "",
      "Qtd Fotos": fotosPorAuditoria[l.id] ?? 0,
      Status: labelStatus(l.status),
    }));
    const ws = XLSX.utils.json_to_sheet(linhasExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio-inventario-doca-${Date.now()}.xlsx`);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Dados operacionais persistidos (independentes do staging temporário).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={limparFiltros}
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Limpar Filtros
          </button>
          <button
            onClick={exportarXLSX}
            disabled={!linhas || linhas.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Download className="size-4" />
            Exportar XLSX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Rota</label>
          <input value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Pedido</label>
          <input value={filtroPedido} onChange={(e) => setFiltroPedido(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nota Fiscal</label>
          <input value={filtroNf} onChange={(e) => setFiltroNf(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Classe</label>
          <input value={filtroClasse} onChange={(e) => setFiltroClasse(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Conferente</label>
          <input value={filtroConferente} onChange={(e) => setFiltroConferente(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Separador</label>
          <input value={filtroSeparador} onChange={(e) => setFiltroSeparador(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Busca livre (Rota/Pedido/NF)</label>
          <input value={buscaLivre} onChange={(e) => setBuscaLivre(e.target.value)} placeholder="Buscar..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="finalizado_sem_divergencia">Finalizado S/Dvg.</option>
            <option value="finalizado_com_divergencia">Finalizado C/Dvg.</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">Data/Hora Bipado</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Rota</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Pedido</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">NF</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Classe</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qtde Contar</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qtde Contada</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Dif</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">% Dif</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Conferente</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Separador</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Observação</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qtd Fotos</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas === null && !erro && (
              <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Carregando relatório...</td></tr>
            )}
            {erro && <tr><td colSpan={14} className="px-3 py-8 text-center text-destructive">{erro}</td></tr>}
            {linhas !== null && linhas.length === 0 && !erro && (
              <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</td></tr>
            )}
            {linhas?.map((l) => (
              <tr key={l.id} className="border-t border-border text-foreground">
                <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(l.data_hora_finalizacao)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.rota ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.pedido}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.nota_fiscal ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.classe ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{l.qtde_contar}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{l.qtde_contada ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatarDif(l.dif)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatarPercentualDif(l.percentual_dif)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.matricula_conferente ? `${l.matricula_conferente} - ${l.nome_conferente}` : "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{separadoresPorPedido[l.pedido_doca_id] ?? "-"}</td>
                <td className="px-3 py-2 max-w-[220px] truncate" title={obsPorAuditoria[l.id] ?? ""}>{obsPorAuditoria[l.id] ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fotosPorAuditoria[l.id] ?? 0}</td>
                <td className="px-3 py-2 whitespace-nowrap">{labelStatus(l.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
