import { useState } from "react";
import { CheckCircle2, LogOut, LayoutDashboard } from "lucide-react";
import type { TemplateProps } from "../types";
import { AuthPanel } from "../shared/auth-panel";
import { Brand, Button } from "../shared/ui";
export default function Auth({ config, imageSrc }: TemplateProps & { imageSrc?: string }) {
  const [entered, setEntered] = useState(false);
  return entered ? (
    <main id="main" className="auth-entered">
      <Brand config={config} />
      <div className="success-card">
        <CheckCircle2 size={56} />
        <span className="eyebrow">FLUXO DE ACESSO</span>
        <h1>Você chegou ao seu espaço.</h1>
        <p>
          Esta tela confirma apenas a navegação da demonstração. Conecte seu
          provedor de autenticação para proteger o aplicativo real.
        </p>
        <Button onClick={() => setEntered(false)}>
          <LogOut size={17} />
          Sair da demonstração
        </Button>
      </div>
    </main>
  ) : (
    <AuthPanel config={config} imageSrc={imageSrc} onEnter={() => setEntered(true)} />
  );
}
