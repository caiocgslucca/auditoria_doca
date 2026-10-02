import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inventário Doca" },
      { name: "description", content: "Plataforma de auditoria de inventário de doca: acompanhamento, coletor, relatórios e dashboard." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <h1 className="text-3xl font-bold text-foreground">Inventário Doca</h1>
      <p className="max-w-md text-muted-foreground">
        Auditoria, acompanhamento, relatórios e dashboard do inventário de doca.
      </p>
      <div className="flex gap-3">
        <Link
          to="/auth"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
