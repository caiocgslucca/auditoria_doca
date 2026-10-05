import { useState } from "react";
import {
  CalendarDays,
  Users,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { TemplateProps, Entity } from "../types";
import { list, makeId } from "../types";
import {
  AppFrame,
  PageHead,
  Button,
  Stat,
  Panel,
  FormModal,
  Modal,
  Avatar,
  Badge,
  Status,
  SettingPanel,
  IconButton,
  Empty,
  useToast,
} from "../shared/ui";
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
const base = "2026-10-05";
export default function Booking({ config }: TemplateProps) {
  const [items, setItems] = useState(list(config, "appointments")),
    [view, setView] = useState("calendar"),
    [offset, setOffset] = useState(0),
    [professional, setProfessional] = useState("Todos"),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Entity | null>(null);
  const toast = useToast();
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset * 7 + i);
    return d;
  });
  const filtered = items.filter(
    (a) => professional === "Todos" || a.category === professional,
  );
  const weekly = filtered.filter((a) => days.some((d) => iso(d) === a.date));
  return (
    <AppFrame
      config={config}
      nav={[
        {
          id: "calendar",
          label: "Minha agenda",
          icon: <CalendarDays size={18} />,
        },
        { id: "team", label: "Profissionais", icon: <Users size={18} /> },
        { id: "settings", label: "Preferências", icon: <Settings size={18} /> },
      ]}
      active={view}
      onNav={setView}
    >
      <PageHead
        eyebrow="AGENDA / SEMANA"
        title={config.content.headline}
        description={config.content.description}
      >
        <Button onClick={() => setCreating(true)}>
          <Plus size={17} />
          Novo agendamento
        </Button>
      </PageHead>
      {view === "settings" ? (
        <SettingPanel />
      ) : view === "team" ? (
        <div className="grid-equal">
          {["Camila", "Rafael"].map((name) => (
            <Panel
              key={name}
              title={name}
              subtitle="Profissional demonstrativo"
            >
              <div className="panel-body stack">
                <Avatar name={name} size={60} />
                <p className="muted">
                  {items.filter((i) => i.category === name).length} horários
                  nesta agenda
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setProfessional(name);
                    setView("calendar");
                  }}
                >
                  Ver agenda
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="Agendamentos na semana"
              value={weekly.length}
              change="Segunda a sexta"
              icon={<CalendarDays size={17} />}
            />
            <Stat
              label="Confirmados"
              value={weekly.filter((i) => i.status === "Confirmado").length}
              change="Tudo certo para receber"
              icon={<CheckCircle2 size={17} />}
            />
            <Stat
              label="A confirmar"
              value={weekly.filter((i) => i.status === "Pendente").length}
              change="Acompanhamento próximo"
              icon={<Clock size={17} />}
            />
            <Stat
              label="Profissionais"
              value="2"
              change="Uma equipe, uma agenda"
            />
          </div>
          <Panel>
            <div className="calendar-toolbar">
              <div className="inline">
                <IconButton
                  label="Semana anterior"
                  onClick={() => setOffset(offset - 1)}
                >
                  <ChevronLeft size={17} />
                </IconButton>
                <IconButton
                  label="Próxima semana"
                  onClick={() => setOffset(offset + 1)}
                >
                  <ChevronRight size={17} />
                </IconButton>
                <h2>
                  {days[0].getUTCDate()} – {days[4].getUTCDate()}{" "}
                  {days[0].toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </h2>
              </div>
              <div className="inline">
                <Button variant="ghost" onClick={() => setOffset(0)}>
                  Semana exemplo
                </Button>
                <select
                  className="select"
                  aria-label="Profissional"
                  value={professional}
                  onChange={(e) => setProfessional(e.target.value)}
                >
                  <option>Todos</option>
                  <option>Camila</option>
                  <option>Rafael</option>
                </select>
              </div>
            </div>
            <div className="calendar-scroll">
              <div className="calendar">
                <div className="calendar-hours">
                  <span>GMT−3</span>
                  {Array.from({ length: 9 }, (_, i) => (
                    <b key={i}>{String(i + 9).padStart(2, "0")}:00</b>
                  ))}
                </div>
                {days.map((d, index) => (
                  <div className="calendar-day" key={iso(d)}>
                    <div className={`day-label ${index === 1 ? "today" : ""}`}>
                      <span>{["SEG", "TER", "QUA", "QUI", "SEX"][index]}</span>
                      <b>{d.getUTCDate()}</b>
                    </div>
                    <div className="day-grid">
                      {Array.from({ length: 9 }, (_, i) => (
                        <button
                          key={i}
                          className="time-slot"
                          aria-label={`Agendar em ${iso(d)} às ${i + 9}:00`}
                          onClick={() => {
                            setSelected({
                              id: "",
                              title: "",
                              date: iso(d),
                              time: `${String(i + 9).padStart(2, "0")}:00`,
                            });
                            setCreating(true);
                          }}
                        />
                      ))}
                      {weekly
                        .filter((a) => a.date === iso(d))
                        .map((a) => (
                          <button
                            key={a.id}
                            className={`appointment ${a.category === "Rafael" ? "purple" : ""}`}
                            style={{
                              top: `${(Number(a.time?.slice(0, 2)) - 9) * 68 + (Number(a.time?.slice(3)) / 60) * 68 + 3}px`,
                            }}
                            onClick={() => setSelected(a)}
                          >
                            <span>
                              {a.time} · {a.duration}
                            </span>
                            <b>{a.title}</b>
                            <small>{a.person}</small>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="table-footer">
              {weekly.length} horários na semana
              <span>Clique em um espaço para agendar</span>
            </div>
          </Panel>
        </>
      )}
      <Modal
        open={!!selected?.id && !creating}
        onClose={() => setSelected(null)}
        title="Detalhes do agendamento"
      >
        {selected && (
          <div className="stack">
            <div className="inline">
              <Avatar name={selected.person} size={50} />
              <div>
                <h3>{selected.person}</h3>
                <p className="muted">{selected.title}</p>
              </div>
            </div>
            <div className="appointment-detail">
              <p>
                <b>Quando</b>
                {selected.date} · {selected.time}
              </p>
              <p>
                <b>Profissional</b>
                {selected.category}
              </p>
              <p>
                <b>Duração</b>
                {selected.duration}
              </p>
            </div>
            <Status value={selected.status} />
            <Button
              onClick={() => {
                setItems((prev) =>
                  prev.map((a) =>
                    a.id === selected.id ? { ...a, status: "Confirmado" } : a,
                  ),
                );
                setSelected(null);
                toast("Agendamento confirmado localmente.");
              }}
            >
              Confirmar horário
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setItems((prev) => prev.filter((a) => a.id !== selected.id));
                setSelected(null);
                toast("Agendamento removido da demonstração.");
              }}
            >
              Cancelar agendamento
            </Button>
          </div>
        )}
      </Modal>
      <FormModal
        open={creating}
        onClose={() => {
          setCreating(false);
          setSelected(null);
        }}
        title="Novo agendamento"
        fields={[
          { name: "person", label: "Nome do cliente" },
          { name: "title", label: "Serviço", value: "Consulta de estilo" },
          {
            name: "category",
            label: "Profissional",
            type: "select",
            options: ["Camila", "Rafael"],
          },
          {
            name: "date",
            label: "Data",
            type: "date",
            value: selected?.date || iso(days[0]),
          },
          {
            name: "time",
            label: "Horário",
            type: "time",
            value: selected?.time || "09:00",
          },
          {
            name: "duration",
            label: "Duração",
            type: "select",
            options: ["30 min", "60 min"],
          },
        ]}
        onSubmit={(d) => {
          if (d.time < "09:00" || d.time > "17:00") {
            toast("Escolha um horário entre 09:00 e 17:00.");
            return false;
          }
          const mins = (s: string) =>
            Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
          if (
            items.some(
              (a) =>
                a.date === d.date &&
                a.category === d.category &&
                mins(d.time) <
                  mins(a.time || "00:00") + parseInt(a.duration || "60") &&
                mins(d.time) + parseInt(d.duration) > mins(a.time || "00:00"),
            )
          ) {
            toast("Este profissional já tem um horário nesse intervalo.");
            return false;
          }
          setItems((p) => [
            ...p,
            { ...d, id: makeId(), title: d.title, status: "Pendente" },
          ]);
          toast("Agendamento incluído na agenda.");
        }}
      />
    </AppFrame>
  );
}
