import { useState } from "react";
import {
  Layers,
  Check,
  Plus,
  LayoutGrid,
  MessageCircle,
  CalendarDays,
  Sparkles,
  Command,
  CheckCircle2,
  Activity,
} from "lucide-react";
import type { TemplateProps } from "../types";
import { list, money } from "../types";
import {
  WebsiteNav,
  Button,
  SectionHead,
  Footer,
  FAQ,
  FormModal,
  Badge,
  Avatar,
  Progress,
  useToast,
} from "../shared/ui";
export default function Saas({ config }: TemplateProps) {
  const [annual, setAnnual] = useState(false),
    [plan, setPlan] = useState("");
  const toast = useToast();
  return (
    <>
      <WebsiteNav
        config={config}
        links={[
          { label: "Por que Fluxo", href: "#produto" },
          { label: "Planos", href: "#planos" },
          { label: "Dúvidas", href: "#duvidas" },
        ]}
        cta="Conheça o seu fluxo"
        onAction={() => setPlan("Pro")}
      />
      <main id="main" className="web-main">
        <section className="saas-hero">
          <div className="saas-orbit orbit-one" />
          <div className="saas-orbit orbit-two" />
          <div className="saas-hero-content hero-enter">
            <Badge>
              <span className="live-dot" />
              MENOS FRICÇÃO. MAIS CRIAÇÃO.
            </Badge>
            <h1 className="hero-title">{config.content.headline}</h1>
            <p className="hero-copy">{config.content.description}</p>
            <div className="hero-buttons">
              <Button onClick={() => setPlan("Pro")}>
                Começar uma nova fase
              </Button>
              <a className="btn ghost" href="#produto">
                Explore o produto
              </a>
            </div>
            <div className="saas-hero-note">
              <Check size={14} />
              Seu trabalho, em boa companhia.
            </div>
          </div>
          <div
            className="saas-product-preview hero-enter hero-delay"
            id="produto"
          >
            <aside>
              <div className="inline">
                <Command size={21} />
                <b>{config.branding.name}</b>
              </div>
              <span>WORKSPACE / CRIATIVO</span>
              <p className="active">
                <LayoutGrid size={14} />
                Meus projetos
              </p>
              <p>
                <MessageCircle size={14} />
                Conversas
              </p>
              <p>
                <CalendarDays size={14} />
                Calendário
              </p>
              <div className="saas-preview-team">
                <Avatar name="Marina" />
                <Avatar name="Clara" />
                <Avatar name="Rafael" />
              </div>
            </aside>
            <div className="saas-preview-main">
              <div className="between">
                <div>
                  <span className="eyebrow">PROJETO / LANÇAMENTO</span>
                  <h2>Boas ideias em movimento.</h2>
                </div>
                <Badge tone="success">EM SINTONIA</Badge>
              </div>
              <div className="saas-preview-stats">
                <div>
                  <span>Projetos em curso</span>
                  <b>03</b>
                </div>
                <div>
                  <span>Pessoas conectadas</span>
                  <b>03</b>
                </div>
                <div>
                  <span>Próximo passo</span>
                  <b>Criar.</b>
                </div>
              </div>
              <div className="saas-tasks">
                {list(config, "tasks").map((t) => (
                  <div key={t.id}>
                    <span className="saas-check">
                      <Check size={13} />
                    </span>
                    <div>
                      <h3>{t.title}</h3>
                      <Progress value={t.progress || 0} />
                    </div>
                    <Badge>{t.status}</Badge>
                    <Avatar name={t.person} size={26} />
                  </div>
                ))}
              </div>
              <div className="saas-preview-foot">
                <span>PRÉVIA ILUSTRATIVA DO PRODUTO</span>
                <button onClick={() => setPlan("Pro")}>
                  Conhecer o plano Pro
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <SectionHead
            eyebrow="UM ESPAÇO. MUITAS POSSIBILIDADES."
            title="Mais conexão entre o plano e a entrega."
          />
          <div className="three-grid">
            {[
              {
                icon: <Layers size={28} />,
                t: "Tudo encontra seu lugar.",
                d: "Projetos, responsáveis e prioridades organizados em uma visão clara.",
              },
              {
                icon: <MessageCircle size={28} />,
                t: "Conversas com contexto.",
                d: "Uma equipe alinhada, com as informações certas sempre por perto.",
              },
              {
                icon: <Activity size={28} />,
                t: "Um ritmo que faz sentido.",
                d: "Acompanhe cada etapa e encontre espaço para o que vem depois.",
              },
            ].map((f) => (
              <article className="feature-card" key={f.t} data-reveal>
                {f.icon}
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section" id="planos">
          <div className="saas-pricing-head">
            <span className="eyebrow">CRESÇA NO SEU RITMO</span>
            <h2>Um plano para cada fase.</h2>
            <div className="billing-toggle">
              <button
                aria-pressed={!annual}
                className={!annual ? "active" : ""}
                onClick={() => setAnnual(false)}
              >
                Mensal
              </button>
              <button
                aria-pressed={annual}
                className={annual ? "active" : ""}
                onClick={() => setAnnual(true)}
              >
                Anual <span>−20%</span>
              </button>
            </div>
          </div>
          <div className="three-grid">
            {list(config, "plans").map((p, i) => (
              <article
                className={`pricing-card ${i === 1 ? "featured" : ""}`}
                key={p.id}
                data-reveal
              >
                {i === 1 && (
                  <div className="pricing-ribbon">PARA O SEU PRÓXIMO PASSO</div>
                )}
                <span className="eyebrow">{p.title}</span>
                <p>{p.description}</p>
                <div className="price">
                  {money((p.price || 0) * (annual ? 0.8 : 1))}
                  <small>/mês</small>
                </div>
                <span className="pricing-note">
                  {annual
                    ? `${money((p.price || 0) * 0.8 * 12)} cobrados ao ano`
                    : "Cobrança mensal · valores ilustrativos"}
                </span>
                <Button
                  variant={i === 1 ? "primary" : "secondary"}
                  className="full"
                  onClick={() => setPlan(p.title)}
                >
                  Escolher {p.title}
                </Button>
                <ul className="check-list">
                  <li>
                    <Check />
                    {p.category} no workspace
                  </li>
                  <li>
                    <Check />
                    Projetos e tarefas organizados
                  </li>
                  <li>
                    <Check />
                    Visão compartilhada da operação
                  </li>
                  <li>
                    <Check />
                    {i === 0
                      ? "Uma base para começar"
                      : i === 1
                        ? "Mais espaço para colaboração"
                        : "Estrutura para novas frentes"}
                  </li>
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section className="section" id="duvidas">
          <SectionHead
            eyebrow="CLAREZA PARA COMEÇAR"
            title="Perguntas que aparecem pelo caminho."
          />
          <FAQ
            items={[
              {
                q: "Como funciona a escolha de plano?",
                a: "O template permite comparar os planos e simular o cadastro. A assinatura real deve ser conectada ao seu sistema de cobrança.",
              },
              {
                q: "Posso trocar de plano depois?",
                a: "A interface pode ser adaptada às regras de troca, cancelamento e cobrança do seu produto.",
              },
              {
                q: "O que está incluso nesta demonstração?",
                a: "Uma landing page com prévia visual, preços mensal e anual, FAQ e formulário de interesse. Não há processamento de pagamento.",
              },
            ]}
          />
        </section>
      </main>
      <Footer config={config} onContact={() => setPlan("Quero conhecer")} />
      <FormModal
        open={!!plan}
        onClose={() => setPlan("")}
        title={`Seu próximo passo: ${plan}`}
        fields={[
          { name: "name", label: "Seu nome" },
          { name: "email", label: "E-mail profissional", type: "email" },
          { name: "company", label: "Nome do workspace" },
        ]}
        submit="Simular início"
        onSubmit={(d) =>
          toast(
            `Workspace ${d.company} registrado nesta demonstração. Nenhuma assinatura foi cobrada.`,
          )
        }
      />
    </>
  );
}
