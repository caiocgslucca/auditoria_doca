import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  Plus,
  Pencil,
  Activity,
  UserCheck,
  UserPlus,
  Download,
} from "lucide-react";
import type { TemplateProps, Entity } from "../types";
import { list, makeId } from "../types";
import {
  AppFrame,
  PageHead,
  Button,
  Stat,
  Panel,
  Avatar,
  Status,
  Search,
  Tabs,
  FormModal,
  SettingPanel,
  LineChart,
  IconButton,
  Empty,
  exportCSV,
  useToast,
} from "../shared/ui";
export default function Admin({ config }: TemplateProps) {
  const [view, setView] = useState("overview"),
    [users, setUsers] = useState(list(config, "users")),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [edit, setEdit] = useState<Entity | null>(null),
    [create, setCreate] = useState(false);
  const toast = useToast();
  const filtered = users.filter(
    (x) =>
      (filter === "Todos" || x.status === filter) &&
      `${x.title} ${x.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const nav = [
    {
      id: "overview",
      label: "Visão geral",
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: "users",
      label: "Usuários",
      icon: <Users size={18} />,
      count: users.length,
    },
    { id: "roles", label: "Papéis & acesso", icon: <Shield size={18} /> },
    { id: "settings", label: "Configurações", icon: <Settings size={18} /> },
  ];
  return (
    <AppFrame config={config} nav={nav} active={view} onNav={setView}>
      <PageHead
        eyebrow="WORKSPACE / OPERAÇÃO"
        title={
          view === "overview"
            ? config.content.headline
            : view === "users"
              ? "Pessoas que fazem acontecer"
              : view === "roles"
                ? "Cada pessoa, o acesso certo"
                : "Do seu jeito"
        }
        description={config.content.description}
      >
        {view !== "settings" && (
          <Button onClick={() => setCreate(true)}>
            <Plus size={17} />
            Adicionar usuário
          </Button>
        )}
      </PageHead>
      {view === "settings" ? (
        <SettingPanel />
      ) : view === "roles" ? (
        <div className="three-grid">
          {["Administrador", "Editor", "Membro"].map((role, i) => (
            <Panel
              key={role}
              title={role}
              subtitle={`${users.filter((x) => x.role === role).length} usuários nesta função`}
            >
              <div className="panel-body">
                <Shield size={30} color="var(--accent)" />
                <p className="muted" style={{ fontSize: 14, margin: "20px 0" }}>
                  {
                    [
                      "Visão completa da operação e configurações.",
                      "Gestão dos conteúdos e atividades da equipe.",
                      "Acesso ao próprio espaço e aos projetos compartilhados.",
                    ][i]
                  }
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setView("users");
                    setQuery("");
                  }}
                >
                  Gerenciar pessoas
                </Button>
                <p className="field-hint">
                  Papéis ilustrativos. Permissões reais exigem validação no
                  servidor.
                </p>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <>
          {view === "overview" && (
            <>
              <div className="stat-grid">
                <Stat
                  label="Usuários no workspace"
                  value={users.length}
                  change="Pessoas cadastradas"
                  icon={<Users size={18} />}
                />
                <Stat
                  label="Ativos agora"
                  value={users.filter((x) => x.status === "Ativo").length}
                  change="Status do cadastro local"
                  icon={<UserCheck size={18} />}
                />
                <Stat
                  label="Convites pendentes"
                  value={users.filter((x) => x.status === "Convidado").length}
                  change="Aguardando primeiro acesso"
                  icon={<UserPlus size={18} />}
                />
                <Stat
                  label="Papéis disponíveis"
                  value="3"
                  change="Organização por responsabilidade"
                  icon={<Shield size={18} />}
                />
              </div>
              <div className="grid-2" style={{ marginBottom: 25 }}>
                <Panel
                  title="Atividade do workspace"
                  subtitle="Interações ilustrativas · últimos 7 dias"
                  action={<span className="badge success">Visão semanal</span>}
                >
                  <LineChart
                    values={[18, 25, 20, 38, 31, 49, 42]}
                    labels={["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]}
                  />
                </Panel>
                <Panel
                  title="Tudo em movimento"
                  subtitle="Resumo dos cadastros"
                >
                  <div className="row-list">
                    {users.slice(0, 3).map((u) => (
                      <div className="list-row" key={u.id}>
                        <Avatar name={u.title} />
                        <div>
                          <h3>{u.title}</h3>
                          <p>{u.role}</p>
                        </div>
                        <Status value={u.status} />
                      </div>
                    ))}
                  </div>
                  <div className="panel-body">
                    <Button
                      variant="ghost"
                      className="full"
                      onClick={() => setView("users")}
                    >
                      Ver todos os usuários
                    </Button>
                  </div>
                </Panel>
              </div>
            </>
          )}
          <Panel
            title={
              view === "overview" ? "Usuários recentes" : "Gerenciar usuários"
            }
            subtitle="Organize a equipe e os acessos"
            action={
              <IconButton
                label="Exportar usuários"
                onClick={() =>
                  exportCSV(
                    "usuarios.csv",
                    ["Nome", "E-mail", "Papel", "Status"],
                    filtered.map((x) => [x.title, x.email, x.role, x.status]),
                  )
                }
              >
                <Download size={17} />
              </IconButton>
            }
          >
            <div className="toolbar panel-body" style={{ paddingBottom: 0 }}>
              <Tabs
                items={["Todos", "Ativo", "Convidado", "Suspenso"]}
                value={filter}
                onChange={setFilter}
              />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="Buscar pessoas…"
              />
            </div>
            {filtered.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Papel</th>
                      <th>Status</th>
                      <th>Criado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="inline">
                            <Avatar name={u.title} />
                            <div>
                              <strong>{u.title}</strong>
                              <span className="secondary">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{u.role}</td>
                        <td>
                          <Status value={u.status} />
                        </td>
                        <td>{u.date}</td>
                        <td>
                          <IconButton
                            label={`Editar ${u.title}`}
                            onClick={() => setEdit(u)}
                          >
                            <Pencil size={15} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
            <div className="table-footer">
              {filtered.length} de {users.length} pessoas
              <span>Alterações locais</span>
            </div>
          </Panel>
        </>
      )}
      <FormModal
        open={create || !!edit}
        onClose={() => {
          setCreate(false);
          setEdit(null);
        }}
        title={edit ? "Editar usuário" : "Adicionar usuário"}
        fields={[
          { name: "title", label: "Nome completo", value: edit?.title },
          { name: "email", label: "E-mail", type: "email", value: edit?.email },
          {
            name: "role",
            label: "Papel",
            type: "select",
            options: ["Administrador", "Editor", "Membro"],
            value: edit?.role || "Membro",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: ["Ativo", "Convidado", "Suspenso"],
            value: edit?.status || "Convidado",
          },
        ]}
        onSubmit={(d) => {
          if (users.some((u) => u.email === d.email && u.id !== edit?.id)) {
            toast("Este e-mail já está cadastrado.");
            return false;
          }
          setUsers((prev) =>
            edit
              ? prev.map((u) => (u.id === edit.id ? { ...u, ...d } : u))
              : [
                  {
                    id: makeId(),
                    title: d.title,
                    email: d.email,
                    role: d.role,
                    status: d.status,
                    date: "Nesta sessão",
                  },
                  ...prev,
                ],
          );
          toast(
            edit ? "Usuário atualizado." : "Usuário adicionado à demonstração.",
          );
        }}
      />
    </AppFrame>
  );
}
