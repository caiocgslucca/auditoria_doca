import { useState } from "react";
import {
  Package,
  ArrowDownUp,
  Settings,
  Plus,
  Download,
  AlertTriangle,
  Boxes,
  MapPin,
} from "lucide-react";
import type { TemplateProps, Entity } from "../types";
import { list, money, makeId } from "../types";
import {
  AppFrame,
  PageHead,
  Button,
  Stat,
  Panel,
  Search,
  Tabs,
  FormModal,
  SettingPanel,
  Badge,
  Empty,
  exportCSV,
  useToast,
} from "../shared/ui";
export default function Inventory({ config }: TemplateProps) {
  const [view, setView] = useState("stock"),
    [items, setItems] = useState(list(config)),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [selected, setSelected] = useState<Entity | null>(null),
    [create, setCreate] = useState(false),
    [logs, setLogs] = useState<string[]>([]);
  const toast = useToast();
  const filtered = items.filter(
    (i) =>
      `${i.title} ${i.subtitle}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "Todos" ||
        (filter === "Baixo estoque" && (i.quantity || 0) < 10) ||
        i.category === filter),
  );
  const value = items.reduce(
    (s, i) => s + (i.quantity || 0) * (i.price || 0),
    0,
  );
  return (
    <AppFrame
      config={config}
      active={view}
      onNav={setView}
      nav={[
        { id: "stock", label: "Meu estoque", icon: <Package size={18} /> },
        {
          id: "history",
          label: "Movimentações",
          icon: <ArrowDownUp size={18} />,
          count: logs.length,
        },
        { id: "settings", label: "Preferências", icon: <Settings size={18} /> },
      ]}
    >
      <PageHead
        eyebrow="OPERAÇÃO / INVENTÁRIO"
        title={config.content.headline}
        description={config.content.description}
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Novo produto
        </Button>
      </PageHead>
      {view === "settings" ? (
        <SettingPanel />
      ) : view === "history" ? (
        <Panel
          title="Histórico de movimentações"
          subtitle="Registros criados nesta sessão"
        >
          {logs.length ? (
            logs.map((l, i) => (
              <div className="list-row" key={i}>
                <div className="big-icon">
                  <ArrowDownUp size={21} />
                </div>
                <div>
                  <h3>{l}</h3>
                  <p>Atualizado nesta sessão</p>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Ainda sem movimentações"
              text="Faça uma entrada ou saída em um produto para ver o histórico."
            />
          )}
        </Panel>
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="Valor do estoque"
              value={money(value)}
              change="Custo unitário × quantidade"
              accent
            />
            <Stat
              label="Produtos cadastrados"
              value={items.length}
              change="SKUs na operação"
              icon={<Package size={18} />}
            />
            <Stat
              label="Unidades disponíveis"
              value={items.reduce((s, i) => s + (i.quantity || 0), 0)}
              change="Somatório do estoque"
              icon={<Boxes size={18} />}
            />
            <Stat
              label="Precisam de atenção"
              value={items.filter((i) => (i.quantity || 0) < 10).length}
              change="Menos de 10 unidades"
              icon={<AlertTriangle size={18} />}
            />
          </div>
          <div className="inventory-notice">
            <AlertTriangle size={19} />
            <div>
              <b>Um estoque saudável começa com antecipação.</b>
              <p>
                Acompanhe os itens com menos de 10 unidades e planeje a
                reposição.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setFilter("Baixo estoque")}>
              Ver alertas
            </Button>
          </div>
          <Panel
            title="Catálogo de produtos"
            subtitle="Visibilidade em cada prateleira"
            action={
              <Button
                variant="ghost"
                onClick={() =>
                  exportCSV(
                    "estoque.csv",
                    ["SKU", "Produto", "Quantidade", "Valor unitário"],
                    items.map((i) => [
                      i.subtitle,
                      i.title,
                      i.quantity,
                      i.price,
                    ]),
                  )
                }
              >
                <Download size={15} />
                Exportar
              </Button>
            }
          >
            <div className="toolbar panel-body" style={{ paddingBottom: 0 }}>
              <Tabs
                items={["Todos", "Baixo estoque", "Papelaria", "Decoração"]}
                value={filter}
                onChange={setFilter}
              />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="Produto ou SKU…"
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Disponível</th>
                    <th>Localização</th>
                    <th>Valor unitário</th>
                    <th>Movimentar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i, n) => (
                    <tr key={i.id}>
                      <td>
                        <div className="inline">
                          <span className={`product-symbol symbol-${n % 3}`}>
                            <Package size={20} />
                          </span>
                          <div>
                            <b>{i.title}</b>
                            <span className="secondary">{i.subtitle}</span>
                          </div>
                        </div>
                      </td>
                      <td>{i.category}</td>
                      <td>
                        <b>{i.quantity} un.</b>
                        <span className="secondary">
                          <Badge
                            tone={
                              (i.quantity || 0) < 10 ? "warning" : "success"
                            }
                          >
                            {i.quantity === 0
                              ? "Esgotado"
                              : (i.quantity || 0) < 10
                                ? "Baixo estoque"
                                : "Normal"}
                          </Badge>
                        </span>
                      </td>
                      <td>{i.location}</td>
                      <td>{money(i.price || 0)}</td>
                      <td>
                        <Button variant="ghost" onClick={() => setSelected(i)}>
                          <ArrowDownUp size={15} />
                          Ajustar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <Empty />}
            <div className="table-footer">
              {filtered.length} produtos encontrados
              <span>Inventário demonstrativo</span>
            </div>
          </Panel>
        </>
      )}
      <FormModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Movimentar: ${selected?.title || ""}`}
        fields={[
          {
            name: "type",
            label: "Movimentação",
            type: "select",
            options: ["Entrada", "Saída"],
          },
          {
            name: "quantity",
            label: "Quantidade inteira",
            type: "number",
            min: 1,
            value: 1,
          },
          { name: "reason", label: "Motivo", value: "Ajuste de estoque" },
        ]}
        onSubmit={(d) => {
          const q = Number(d.quantity);
          if (!Number.isInteger(q) || q < 1) {
            toast("Informe uma quantidade inteira maior que zero.");
            return false;
          }
          const next =
            (selected?.quantity || 0) + (d.type === "Entrada" ? q : -q);
          if (next < 0) {
            toast("Saída maior que o estoque disponível.");
            return false;
          }
          setItems((p) =>
            p.map((i) =>
              i.id === selected?.id ? { ...i, quantity: next } : i,
            ),
          );
          setLogs((p) => [
            `${d.type} de ${q} un. · ${selected?.title} · ${d.reason}`,
            ...p,
          ]);
          toast("Estoque atualizado.");
        }}
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Adicionar produto"
        fields={[
          { name: "title", label: "Nome do produto" },
          { name: "subtitle", label: "Código SKU" },
          {
            name: "category",
            label: "Categoria",
            type: "select",
            options: ["Papelaria", "Eletrônicos", "Decoração"],
          },
          {
            name: "quantity",
            label: "Quantidade inicial",
            type: "number",
            min: 0,
            value: 0,
          },
          {
            name: "price",
            label: "Valor unitário (R$)",
            type: "number",
            min: 0,
          },
          { name: "location", label: "Localização", value: "A-01" },
        ]}
        onSubmit={(d) => {
          if (items.some((i) => i.subtitle === d.subtitle)) {
            toast("Este SKU já existe.");
            return false;
          }
          if (!Number.isInteger(Number(d.quantity))) {
            toast("A quantidade precisa ser inteira.");
            return false;
          }
          setItems((p) => [
            ...p,
            {
              ...d,
              id: makeId(),
              title: d.title,
              quantity: Number(d.quantity),
              price: Number(d.price),
            },
          ]);
          toast("Produto cadastrado localmente.");
        }}
      />
    </AppFrame>
  );
}
