import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Camera, X, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/useAuthUser";
import { iniciarAuditoria, finalizarAuditoria, registrarFotoAuditoria, adicionarObservacaoAuditoria } from "@/lib/doca/auditoria.functions";

export const Route = createFileRoute("/doca/coletor/auditar")({
  head: () => ({ meta: [{ title: "Auditar — Coletor" }] }),
  component: AuditarPage,
});

interface PedidoEncontrado {
  id: string;
  nu_pedido_origem: string;
  nu_doc_erp: string | null;
  cd_rota: number | null;
  cd_classe: string | null;
  qtde_contar: number;
}

function AuditarPage() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pedido, setPedido] = useState<PedidoEncontrado | null>(null);
  const [auditoriaId, setAuditoriaId] = useState<string | null>(null);
  const [notaFiscal, setNotaFiscal] = useState("");
  const [qtdeContada, setQtdeContada] = useState("");
  const [fotos, setFotos] = useState<{ preview: string; file: File }[]>([]);
  const [observacao, setObservacao] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [resultado, setResultado] = useState<{ status: string; dif: number | null } | null>(null);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</main>;
  }
  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  async function buscarPedido() {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      const termo = busca.trim();
      const numTermo = isNaN(Number(termo)) ? -1 : Number(termo);
      const query = supabase
        .from("pedidos_doca")
        .select("id, nu_pedido_origem, nu_doc_erp, cd_rota, cd_classe, qtde_contar")
        .limit(1);
      const { data } = await query.or(
        `nu_pedido_origem.eq.${termo},cd_rota.eq.${numTermo},nu_doc_erp.eq.${termo}`,
      );
      if (!data || data.length === 0) {
        toast.error("Pedido não encontrado para Rota/Pedido/Nota Fiscal informado.");
        setPedido(null);
        return;
      }
      const encontrado = data[0] as PedidoEncontrado;
      setPedido(encontrado);
      const resp = await iniciarAuditoria({
        data: { pedidoDocaId: encontrado.id, conferente: { userId: user.userId, matricula: user.matricula, nome: user.nome } },
      } as any);
      setAuditoriaId((resp as any).id);
    } catch (e: any) {
      toast.error("Erro ao buscar pedido: " + e.message);
    } finally {
      setBuscando(false);
    }
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setFotos((prev) => [...prev, { preview, file }]);
    e.target.value = "";
  }

  function removerFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFinalizar() {
    if (!auditoriaId || !pedido) return;
    const qtd = Number(qtdeContada);
    if (!qtdeContada || isNaN(qtd) || qtd < 0) {
      toast.error("Informe a Qtde Contada.");
      return;
    }
    setFinalizando(true);
    try {
      for (const foto of fotos) {
        const path = `${pedido.nu_pedido_origem}/${Date.now()}-${foto.file.name}`;
        const { error: errUpload } = await supabase.storage.from("inventario-doca-fotos").upload(path, foto.file);
        if (errUpload) throw new Error(errUpload.message);
        await registrarFotoAuditoria({
          data: { auditoriaId, storagePath: path, nomeArquivo: foto.file.name, tipo: "fardo", createdBy: user.userId },
        } as any);
      }
      if (observacao.trim()) {
        await adicionarObservacaoAuditoria({
          data: { auditoriaId, texto: observacao.trim(), userId: user.userId, matricula: user.matricula, nome: user.nome },
        } as any);
      }
      const atualizado = await finalizarAuditoria({
        data: { auditoriaId, qtdeContada: qtd, notaFiscal: notaFiscal.trim() || null },
      } as any);
      setResultado({ status: (atualizado as any).status, dif: (atualizado as any).dif });
      toast.success("Auditoria finalizada.");
    } catch (e: any) {
      toast.error("Erro ao finalizar auditoria: " + e.message);
    } finally {
      setFinalizando(false);
    }
  }

  function novaAuditoria() {
    setPedido(null);
    setAuditoriaId(null);
    setBusca("");
    setNotaFiscal("");
    setQtdeContada("");
    setFotos([]);
    setObservacao("");
    setResultado(null);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <Link to="/doca/coletor" className="p-2 -ml-2 text-foreground">
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Auditar</h1>
      </header>

      <div className="flex-1 px-4 py-5 space-y-5">
        {!pedido && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Rota, Pedido ou Nota Fiscal</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarPedido()}
                placeholder="Digite ou bipe..."
                className="flex-1 rounded-lg border border-input bg-background px-4 py-4 text-lg text-foreground"
              />
              <button
                onClick={buscarPedido}
                disabled={buscando}
                className="rounded-lg bg-primary px-5 text-primary-foreground disabled:opacity-60"
              >
                <Search className="size-6" />
              </button>
            </div>
          </div>
        )}

        {pedido && !resultado && (
          <>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Pedido</p>
              <p className="text-xl font-semibold text-foreground">{pedido.nu_pedido_origem}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                <div><span className="text-muted-foreground">Rota: </span><span className="text-foreground font-medium">{pedido.cd_rota ?? "-"}</span></div>
                <div><span className="text-muted-foreground">Classe: </span><span className="text-foreground font-medium">{pedido.cd_classe ?? "-"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Qtde Contar: </span><span className="text-foreground font-semibold">{pedido.qtde_contar}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Nota Fiscal (opcional)</label>
              <input
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Qtde Contada *</label>
              <input
                type="number"
                inputMode="numeric"
                value={qtdeContada}
                onChange={(e) => setQtdeContada(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-4 text-xl font-semibold text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Foto do Fardo</label>
              <div className="flex flex-wrap gap-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative size-20 rounded-lg overflow-hidden border border-border">
                    <img src={f.preview} alt="Foto do fardo" className="size-full object-cover" />
                    <button
                      onClick={() => removerFoto(i)}
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground">
                  <Camera className="size-6" />
                  <span className="text-[10px]">Tirar foto</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Observações</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                placeholder="Ex: embalagem avariada, falta de volume..."
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"
              />
            </div>

            <button
              onClick={handleFinalizar}
              disabled={finalizando}
              className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground disabled:opacity-60"
            >
              {finalizando ? "Finalizando..." : "FINALIZAR AUDITORIA"}
            </button>
          </>
        )}

        {resultado && (
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <div
              className={
                "rounded-full px-6 py-3 text-lg font-bold " +
                (resultado.status === "finalizado_sem_divergencia"
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive")
              }
            >
              {resultado.status === "finalizado_sem_divergencia" ? "FINALIZADO SEM DIVERGÊNCIA" : "FINALIZADO COM DIVERGÊNCIA"}
            </div>
            <p className="text-muted-foreground">Dif: {resultado.dif ?? 0}</p>
            <button
              onClick={novaAuditoria}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Auditar outro pedido
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
