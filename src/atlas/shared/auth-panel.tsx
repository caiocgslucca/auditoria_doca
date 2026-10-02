import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  CheckCircle2,
  Mail,
  Layers,
  ShieldCheck,
} from "lucide-react";
import type { TemplateConfig } from "../types";
import { Brand, Button, Photo, useToast } from "./ui";
export function AuthPanel({
  config,
  onEnter,
  imageSrc,
}: {
  config: TemplateConfig;
  onEnter: () => void;
  imageSrc?: string;
}) {
  const [mode, setMode] = useState("login"),
    [show, setShow] = useState(false),
    [success, setSuccess] = useState(false);
  const toast = useToast();
  return (
    <main id="main" className="auth-layout">
      <section className="auth-visual">
        <Photo
          name={imageSrc || config.content.heroImage}
          alt={config.content.heroAlt || `Imagem de ${config.branding.name}`}
          loading="eager"
        />
        <div className="auth-visual-top">
          <Brand config={config} />
          <span>{config.branding.tagline}</span>
        </div>
        <div className="auth-visual-copy">
          <span className="auth-pill">
            <Layers size={14} />
            {config.content.visualBadge || config.branding.tagline}
          </span>
          <h1>{config.content.headline}</h1>
          <p>{config.content.visualDescription || config.content.description}</p>
          <div className="auth-visual-bottom">
            <span>{config.content.visualFooter || config.branding.tagline}</span>
          </div>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand config={config} />
        </div>
        <div className="auth-box">
          {success ? (
            <div className="success-card">
              <CheckCircle2 size={48} />
              <h2>Fluxo concluído</h2>
              <p>
                {mode === "recover"
                  ? "A solicitação de recuperação foi simulada. Nenhum e-mail foi enviado."
                  : "Seu cadastro de demonstração está pronto. Os dados não foram enviados nem armazenados."}
              </p>
              <Button
                onClick={() => {
                  setMode("login");
                  setSuccess(false);
                }}
              >
                Voltar para entrar
              </Button>
            </div>
          ) : (
            <>
              <div className="auth-icon">
                <LockKeyhole size={24} />
              </div>
              <span className="eyebrow">{config.content.eyebrow}</span>
              <h2>
                {mode === "login"
                  ? config.content.loginTitle || "Acesse sua conta"
                  : mode === "register"
                    ? config.content.registerTitle || "Crie sua conta"
                    : config.content.recoverTitle || "Recupere sua senha"}
              </h2>
              <p>
                {mode === "login"
                  ? config.content.description
                  : mode === "register"
                    ? config.content.registerDescription || config.content.description
                    : config.content.recoverDescription || "Informe seu e-mail para recuperar o acesso."}
              </p>
              {mode !== "recover" && (
                <div className="auth-tabs">
                  <button
                    className={mode === "login" ? "active" : ""}
                    onClick={() => setMode("login")}
                  >
                    Entrar
                  </button>
                  <button
                    className={mode === "register" ? "active" : ""}
                    onClick={() => setMode("register")}
                  >
                    Criar conta
                  </button>
                </div>
              )}
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mode === "login") {
                    toast("Entrada demonstrativa, sem autenticação real.");
                    onEnter();
                  } else setSuccess(true);
                  e.currentTarget.reset();
                }}
              >
                {mode === "register" && (
                  <label className="field">
                    <span>Nome completo</span>
                    <input
                      autoComplete="name"
                      placeholder="Como podemos chamar você?"
                      required
                    />
                  </label>
                )}
                <label className="field">
                  <span>Seu e-mail</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </label>
                {mode !== "recover" && (
                  <label className="field">
                    <span>Senha</span>
                    <div className="password-wrap">
                      <input
                        type={show ? "text" : "password"}
                      aria-label="Senha"
                      aria-describedby="auth-password-hint"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        placeholder="Use uma senha de exemplo"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                        onClick={() => setShow(!show)}
                      >
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <small id="auth-password-hint" className="field-hint">
                      Mínimo de 8 caracteres. Use dados fictícios.
                    </small>
                  </label>
                )}
                {mode === "login" && (
                  <div className="between auth-options">
                    <span>Acesso de demonstração</span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setMode("recover")}
                    >
                      Esqueci a senha
                    </button>
                  </div>
                )}
                {mode === "register" && (
                  <label className="auth-consent">
                    <input type="checkbox" required />
                    Entendo que este é um cadastro de demonstração.
                  </label>
                )}
                <Button type="submit" className="full">
                  {mode === "login"
                    ? "Entrar na demonstração"
                    : mode === "register"
                      ? "Simular cadastro"
                      : "Simular recuperação"}
                </Button>
                {mode === "recover" && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setMode("login")}
                  >
                    Voltar para entrar
                  </Button>
                )}
              </form>
              <div className="auth-demo">
                <ShieldCheck size={17} />
                <p>
                  Ambiente de demonstração. Sem autenticação real ou
                  armazenamento de senhas.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="auth-bottom">
          <span>© {config.branding.name}</span>
          <span>{config.branding.tagline}</span>
        </div>
      </section>
    </main>
  );
}
