import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClipboardCheck, Search, LogOut } from "lucide-react";
import { useAuthUser } from "@/lib/useAuthUser";
import { supabase } from "@/integrations/supabase/client";

// HOME mobile-first do Coletor: autentica o usuário e exibe apenas as duas
// ações operacionais (AUDITAR e CONSULTA). AUDITAR delega para
// /doca/coletor/auditar (foto -> Supabase Storage, cálculo de Dif/%Dif via
// finalizarAuditoria). CONSULTA delega para /doca/coletor/consulta
// (leitura por Rota/Pedido/NF).
export const Route = createFileRoute("/doca/coletor")({
  head: () => ({ meta: [{ title: "Coletor — Inventário Doca" }] }),
  component: ColetorHome,
});

function ColetorHome() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </main>
    );
  }
  if (!user) return null;

  const nome = user.nome;

  return (
    <main className="min-h-screen bg-[hsl(var(--sidebar-background))] text-white flex flex-col">
      <header className="px-5 pt-8 pb-6">
        <p className="text-sm text-white/70">Inventário Doca</p>
        <h1 className="text-2xl font-semibold mt-1">Olá, {nome}</h1>
      </header>

      <div className="flex-1 px-5 pb-10 flex flex-col gap-4">
        <Link
          to="/doca/coletor/auditar"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-10 text-xl font-bold shadow-lg active:scale-[0.98] transition-transform"
        >
          <ClipboardCheck className="size-10" />
          AUDITAR
          <span className="text-sm font-normal opacity-90">Realizar auditoria</span>
        </Link>

        <Link
          to="/doca/coletor/consulta"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/20 py-10 text-xl font-bold active:scale-[0.98] transition-transform"
        >
          <Search className="size-10" />
          CONSULTA
          <span className="text-sm font-normal opacity-80">Consultar pedidos</span>
        </Link>
      </div>

      <button
        onClick={sair}
        className="mx-5 mb-8 flex items-center justify-center gap-2 rounded-xl border border-white/20 py-3.5 text-base font-medium text-white/85 active:bg-white/10"
      >
        <LogOut className="size-5" />
        Sair
      </button>
    </main>
  );
}
