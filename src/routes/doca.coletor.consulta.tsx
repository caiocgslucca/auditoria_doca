import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search as SearchIcon, Camera, BookOpen } from "lucide-react";
import { useAuthUser } from "@/lib/useAuthUser";
import { supabase } from "@/integrations/supabase/client";
import { formatarDif, formatarPercentualDif, formatarMatriculaNome, labelStatus } from "@/lib/doca/rules";

export const Route = createFileRoute("/doca/coletor/consulta")({
  head: () => ({ meta: [{ title: "Consulta — Coletor Inventário Doca" }] }),
  component: ConsultaPage,
});

interface ResultadoConsulta {
  id: string;
  pedido_doca_id: string;
  rota: string | null;
  pedido: string;
  nota_fiscal: string | null;
  classe: string | null;
  qtde_contar: number;
  qtde_contada: number | null;
  dif: number | null;
  status: string;
  matricula_conferente: string | null;
  nome_conferente: string | null;
  data_hora_finalizacao: string | null;
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ConsultaPage() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [rota, setRota] = useState("");
  const [pedido, setPedido] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoConsulta[] | null>(null);
  const [separadores, setSeparadores] = useState<Record<string, { cd_funcionario: number; nm_funcionario: string }[]>>({});
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!rota.trim() && !pedido.trim() && !notaFiscal.trim()) {
      setErro("Informe ao menos Rota, Pedido ou Nota Fiscal.");
      return;
    }
    setErro(null);
    setBuscando(true);
    let query = supabase
      .from("doca_auditorias")
      .select(
        "id, pedido_doca_id, rota, pedido, nota_fiscal, classe, qtde_contar, qtde_contada, dif, status, matricula_conferente, nome_conferente, data_hora_finalizacao",
      )
      .is("deleted_at", null)
      .eq("is_current", true);
    if (pedido.trim()) query = query.eq("pedido", pedido.trim());
    if (rota.trim()) query = query.eq("rota", rota.trim());
    if (notaFiscal.trim()) query = query.eq("nota_fiscal", notaFiscal.trim());

    const { data, error } = await query;
    setBuscando(false);
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    setResultados((data ?? []) as ResultadoConsulta[]);

    const pedidoDocaIds = Array.from(new Set((data ?? []).map((l: any) => l.pedido_doca_id)));
    if (pedidoDocaIds.length) {
      const { data: seps } = await supabase
        .from("doca_pedido_separadores")
        .select("pedido_doca_id, cd_funcionario, nm_funcionario")
        .in("pedido_doca_id", pedidoDocaIds);
      const agrupado: Record<string, { cd_funcionario: number; nm_funcionario: string }[]> = {};
      for (const s of seps ?? []) {
        const key = (s as any).pedido_doca_id;
        if (!agrupado[key]) agrupado[key] = [];
        agrupado[key].push(s as any);
      }
      setSeparadores(agrupado);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[hsl(var(--sidebar-background))] text-white/80">
        Carregando...
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 bg-[hsl(var(--sidebar-background))] text-white px-4 py-4">
        <Link to="/doca/coletor" className="p-1 -ml-1">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold">Consulta</h1>
      </header>

      <form onSubmit={buscar} className="p-4 space-y-3 bg-card border-b border-border">
        <input
          value={rota}
          onChange={(e) => setRota(e.target.value)}
          placeholder="Rota"
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"
        />
        <input
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder="Pedido"
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"
        />
        <input
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Nota Fiscal"
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <button
          type="submit"
          disabled={buscando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          <SearchIcon className="size-5" />
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      <div className="flex-1 p-4 space-y-3">
        {resultados === null && (
          <p className="text-center text-muted-foreground text-sm pt-6">Informe um critério e toque em Buscar.</p>
        )}
        {resultados !== null && resultados.length === 0 && (
          <p className="text-center text-muted-foreground text-sm pt-6">
            Nenhum registro encontrado para os filtros selecionados.
          </p>
        )}
        {resultados?.map((r) => {
          const seps = separadores[r.pedido_doca_id] ?? [];
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-foreground">{r.pedido}</span>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-semibold " +
                    (r.status === "finalizado_com_divergencia"
                      ? "bg-destructive/10 text-destructive"
                      : r.status === "finalizado_sem_divergencia"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {labelStatus(r.status as any)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Rota {r.rota ?? "-"} · NF {r.nota_fiscal ?? "-"} · Classe {r.classe ?? "-"}
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Contar</p>
                  <p className="font-semibold text-foreground">{r.qtde_contar}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contada</p>
                  <p className="font-semibold text-foreground">{r.qtde_contada ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dif</p>
                  <p className="font-semibold text-foreground">{formatarDif(r.dif)}</p>
                </div>
              </div>
              <p className="text-sm text-foreground">
                Conferente: {formatarMatriculaNome(r.matricula_conferente, r.nome_conferente)}
              </p>
              <p className="text-sm text-foreground">
                Separador: {seps[0] ? formatarMatriculaNome(String(seps[0].cd_funcionario), seps[0].nm_funcionario) : "-"}
                {seps.length > 1 && <span className="text-xs text-muted-foreground"> +{seps.length - 1}</span>}
              </p>
              <p className="text-xs text-muted-foreground">Bipado em {formatarDataHora(r.data_hora_finalizacao)}</p>
              <div className="flex gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Camera className="size-3.5" /> Fotos
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="size-3.5" /> Observações
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
