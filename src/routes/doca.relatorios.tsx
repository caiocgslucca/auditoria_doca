import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function RelatoriosPage() {
  const [linhas, setLinhas] = useState<LinhaRelatorio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [separadoresPorPedido, setSeparadoresPorPedido] = useState<Record<string, string>>({});
  const [filtroRota, setFiltroRota] = useState("");
  const [filtroPedido, setFiltroPedido] = useState("");
  const [filtroClasse, setFiltroClasse] = useState("");

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
    if (filtroClasse) query = query.eq("classe", filtroClasse);

    const { data, error } = await query;
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    setLinhas((data ?? []) as LinhaRelatorio[]);

    const pedidoIds = Array.from(new Set((data ?? []).map((l: any) => l.pedido_doca_id)));
    if (pedidoIds.length) {
      const { data: seps } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoIds);
      const mapa: Record<string, string> = {};
      for (const s of seps ?? []) {
        const key = (s as any).pedido_doca_id;
        if (!mapa[key]) mapa[key] = `${(s as any).cd_funcionario} - ${(s as any).nm_funcionario}`;
      }
      setSeparadoresPorPedido(mapa);
    }
  }

  useEffect(() => {
    carregar();
  }, [filtroRota, filtroPedido, filtroClasse]);

  function exportarXLSX() {
    const linhasExport = (linhas ?? []).map((l) => ({
      "Data/Hora Bipado": l.data_hora_finalizacao ?? "",
      Rota: l.rota ?? "",
      Pedido: l.pedido,
      "Nota Fiscal": l.nota_fiscal ?? "",
      Classe: l.classe ?? "",
      "Qtde Contar": l.qtde_contar,
      "Qtde Contada": l.qtde_contada ?? "",
      Dif: l.dif ?? "",
      "% Dif": l.percentual_dif ?? "",
      "Matrícula Conferente": l.matricula_conferente ?? "",
      "Nome Conferente": l.nome_conferente ?? "",
      Separador: separadoresPorPedido[l.pedido_doca_id] ?? "",
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
        <button
          onClick={exportarXLSX}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Download className="size-4" />
          Exportar XLSX
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Rota"
          value={filtroRota}
          onChange={(e) => setFiltroRota(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <input
          placeholder="Pedido"
          value={filtroPedido}
          onChange={(e) => setFiltroPedido(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <input
          placeholder="Classe"
          value={filtroClasse}
          onChange={(e) => setFiltroClasse(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">Data/Hora Bipado</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Rota</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Pedido</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Nota Fiscal</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Classe</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qtde Contar</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Qtde Contada</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Dif</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">% Dif</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Conferente</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Separador</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas === null && !erro && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Carregando relatório...</td></tr>
            )}
            {erro && <tr><td colSpan={12} className="px-3 py-8 text-center text-destructive">{erro}</td></tr>}
            {linhas !== null && linhas.length === 0 && !erro && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</td></tr>
            )}
            {linhas?.map((l) => (
              <tr key={l.id} className="border-t border-border text-foreground">
                <td className="px-3 py-2 whitespace-nowrap">{l.data_hora_finalizacao ? new Date(l.data_hora_finalizacao).toLocaleString("pt-BR") : "-"}</td>
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
                <td className="px-3 py-2 whitespace-nowrap">{labelStatus(l.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
