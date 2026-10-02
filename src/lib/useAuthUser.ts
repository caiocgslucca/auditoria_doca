import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuthUserInfo {
  userId: string;
  email: string | null;
  matricula: string;
  nome: string;
}

/**
 * Retorna o usuário autenticado + snapshot de matrícula/nome (profiles).
 * Usado para persistir o CONFERENTE nas auditorias — nunca confundir com
 * o SEPARADOR, que vem da importação (CD_FUNCIONARIO/NM_FUNCIONARIO).
 */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData.session?.user;
      if (!authUser) {
        if (ativo) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("matricula, full_name, email")
        .eq("id", authUser.id)
        .maybeSingle();
      if (ativo) {
        setUser({
          userId: authUser.id,
          email: authUser.email ?? null,
          matricula: profile?.matricula ?? authUser.id.slice(0, 6),
          nome: profile?.full_name ?? authUser.email ?? "Usuário",
        });
        setLoading(false);
      }
    }

    carregar();
    const { data: sub } = supabase.auth.onAuthStateChange(() => carregar());
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
