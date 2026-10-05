import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  COLUNAS_IMPORTACAO_DOCA,
  validarCabecalho,
  importarParaTemporario,
  efetivarImportacaoParaOperacional,
  limparTemporario,
  type ValidacaoImportacao,
  type LinhaImportacaoDoca,
} from "@/lib/doca/import.functions";

export const Route = createFileRoute("/doca/temporario")({
  head: () => ({ meta: [{ title: "Temporário / Importação — Inventário Doca" }] }),
  component: TemporarioPage,
});

const MAPA_CABECALHO_PARA_CAMPO: Record<string, keyof LinhaImportacaoDoca> = {
  CD_EMPRESA: "cd_empresa",
  "DATA HORA INTEGRAÇÃO": "data_hora_integracao",
  "DATA INTEGRAÇÃO": "data_integracao",
  "DATA HORA LIB ONDA": "data_hora_lib_onda",
  "DATA LIB ONDA": "data_lib_onda",
  NU_DOC_ERP: "nu_doc_erp",
  NU_PEDIDO_ORIGEM: "nu_pedido_origem",
  CD_ONDA: "cd_onda",
  CD_ROTA: "cd_rota",
  TP_PEDIDO: "tp_pedido",
  CD_SITUACAO: "cd_situacao",
  CD_CLASSE: "cd_classe",
  CD_ENDERECO: "cd_endereco",
  CD_PRODUTO: "cd_produto",
  DS_PRODUTO: "ds_produto",
  QT_PRODUTO: "qt_produto",
  QT_SEPARADO: "qt_separado",
  QT_CANCELADO: "qt_cancelado",
  QTD_PENDENTE: "qtd_pendente",
  "DATA HORA SEPARAÇÃO": "data_hora_separacao",
  CD_CARGA: "cd_carga",
  CD_FUNCIONARIO: "cd_funcionario",
  NM_FUNCIONARIO: "nm_funcionario",
  CD_TURNO: "cd_turno",
  "DATA SEPARAÇÃO": "data_separacao",
  "HORA SEPARAÇÃO": "hora_separacao",
  "DATA OFICIAL": "data_oficial",
  "TURNO ROTA": "turno_rota",
  STATUS_SEPARACAO: "status_separacao",
  DATA_SEP_ORIGINAL: "data_sep_original",
  DS: "ds",
  NU_SEPARACAO: "nu_separacao",
  NU_CONTENEDOR: "nu_contenedor",
  DS_ONDA: "ds_onda",
};

const CAMPOS_NUMERICOS = new Set<keyof LinhaImportacaoDoca>([
  "cd_empresa",
  "cd_onda",
  "cd_rota",
  "cd_situacao",
  "qt_produto",
  "qt_separado",
  "qt_cancelado",
  "qtd_pendente",
  "cd_funcionario",
  "cd_turno",
  "nu_separacao",
  "nu_contenedor",
]);

function linhaPlanilhaParaObjeto(linha: Record<string, any>): LinhaImportacaoDoca {
  const obj: Record<string, any> = {};
  for (const [cabecalho, campo] of Object.entries(MAPA_CABECALHO_PARA_CAMPO)) {
    let valor = linha[cabecalho];
    if (valor === undefined || valor === "") valor = null;
    if (valor !== null && CAMPOS_NUMERICOS.has(campo)) {
      const n = Number(valor);
      valor = Number.isFinite(n) ? n : null;
    }
    obj[campo] = valor;
  }
  return obj as LinhaImportacaoDoca;
}

interface LinhaTemp {
  id: string;
  nu_pedido_origem: string;
  nu_doc_erp: string | null;
  cd_onda: number | null;
  cd_rota: number | null;
  cd_classe: string | null;
  cd_endereco: string | null;
  cd_produto: string | null;
  ds_produto: string | null;
  qt_produto: number | null;
  qt_separado: number | null;
  qt_cancelado: number | null;
  qtd_pendente: number | null;
  cd_funcionario: number | null;
  nm_funcionario: string | null;
  data_separacao: string | null;
  status_separacao: string | null;
  nu_separacao: number | null;
  nu_contenedor: number | null;
  ds_onda: string | null;
  data_integracao: string | null;
  data_lib_onda: string | null;
}

function TemporarioPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [validacao, setValidacao] = useState<ValidacaoImportacao | null>(null);
  const [linhasParaImportar, setLinhasParaImportar] = useState<LinhaImportacaoDoca[]>([]);
  const [processando, setProcessando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaTemp[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [pagina, setPagina] = useState(1);
  const porPagina = 50;

  async function carregar() {
    setErro(null);
    const { data, error } = await supabase
      .from("pedidos_doca_temp")
      .select(
        "id, nu_pedido_origem, nu_doc_erp, cd_onda, cd_rota, cd_classe, cd_endereco, cd_produto, ds_produto, qt_produto, qt_separado, qt_cancelado, qtd_pendente, cd_funcionario, nm_funcionario, data_separacao, status_separacao, nu_separacao, nu_contenedor, ds_onda, data_integracao, data_lib_onda",
      )
      .order("nu_pedido_origem", { ascending: true })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);
    if (error) {
      setErro("Não foi possível carregar os dados. Tentar novamente.");
      return;
    }
    setLinhas((data ?? []) as LinhaTemp[]);
  }

  useEffect(() => {
    carregar();
  }, [pagina]);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bin = ev.target?.result;
      const wb = XLSX.read(bin, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const linhasPlanilha: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
      const cabecalhos = linhasPlanilha.length
        ? Object.keys(linhasPlanilha[0])
        : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) ?? [];
      const resultado = validarCabecalho(file.name, cabecalhos, linhasPlanilha.length);
      setValidacao(resultado);
      if (resultado.podeImportar) {
        setLinhasParaImportar(linhasPlanilha.map(linhaPlanilhaParaObjeto).filter((l) => l.nu_pedido_origem));
      } else {
        setLinhasParaImportar([]);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function confirmarImportacao() {
    if (!linhasParaImportar.length) return;
    setProcessando(true);
    try {
      await importarParaTemporario({ data: linhasParaImportar } as any);
      const resultado = await efetivarImportacaoParaOperacional();
      toast.success(
        `Importação concluída: ${(resultado as any).pedidosProcessados} pedidos, ${(resultado as any).separadoresPersistidos} separadores persistidos.`,
      );
      setValidacao(null);
      setLinhasParaImportar([]);
      if (fileRef.current) fileRef.current.value = "";
      carregar();
    } catch (e: any) {
      toast.error("Erro ao importar: " + e.message);
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarLimpeza() {
    try {
      await limparTemporario();
      toast.success("Dados do dia (área temporária) foram limpos. Histórico e separadores persistidos permanecem intactos.");
      setConfirmandoLimpeza(false);
      carregar();
    } catch (e: any) {
      toast.error("Erro ao limpar: " + e.message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Temporário / Importação</h1>
        <p className="text-sm text-muted-foreground">
          Área de staging (34 colunas). A limpeza aqui nunca apaga separador, auditorias, fotos ou observações já
          persistidos no Acompanhamento.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleArquivo}
            className="text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => setConfirmandoLimpeza(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            Limpar Dados do Dia
          </button>
        </div>

        {validacao && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Arquivo: {validacao.arquivoNome}</p>
            <p className="text-muted-foreground">Linhas encontradas: {validacao.linhasEncontradas}</p>
            <p className="text-muted-foreground">Colunas encontradas: {validacao.colunasEncontradas.length}</p>
            <p className="text-muted-foreground">Colunas válidas: {validacao.colunasValidas.length} / {COLUNAS_IMPORTACAO_DOCA.length}</p>
            {validacao.colunasAusentes.length > 0 && (
              <p className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="size-4 mt-0.5" />
                Colunas ausentes: {validacao.colunasAusentes.join(", ")}
              </p>
            )}
            {validacao.podeImportar ? (
              <div className="flex items-center gap-3 pt-1">
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <CheckCircle2 className="size-4" /> Estrutura compatível, pronto para importar.
                </span>
                <button
                  type="button"
                  disabled={processando}
                  onClick={confirmarImportacao}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  <Upload className="size-4" />
                  {processando ? "Importando..." : "Confirmar Importação"}
                </button>
              </div>
            ) : (
              <p className="text-destructive font-medium">
                Estrutura incompatível: corrija o arquivo antes de importar. Nenhum dado foi importado.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA INTEGRAÇÃO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA LIB ONDA</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NU_DOC_ERP</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NU_PEDIDO_ORIGEM</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_ONDA</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_ROTA</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_CLASSE</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_ENDERECO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_PRODUTO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DS_PRODUTO</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">QT_PRODUTO</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">QT_SEPARADO</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">QT_CANCELADO</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">QTD_PENDENTE</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">CD_FUNCIONARIO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NM_FUNCIONARIO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DATA SEPARAÇÃO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">STATUS_SEPARACAO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NU_SEPARACAO</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">NU_CONTENEDOR</th>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">DS_ONDA</th>
            </tr>
          </thead>
          <tbody>
            {linhas === null && !erro && (
              <tr>
                <td colSpan={21} className="px-3 py-8 text-center text-muted-foreground">Carregando registros...</td>
              </tr>
            )}
            {erro && (
              <tr>
                <td colSpan={21} className="px-3 py-8 text-center text-destructive">{erro}</td>
              </tr>
            )}
            {linhas !== null && linhas.length === 0 && !erro && (
              <tr>
                <td colSpan={21} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum registro na área temporária.
                </td>
              </tr>
            )}
            {linhas?.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.data_integracao ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.data_lib_onda ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nu_doc_erp ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nu_pedido_origem}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_onda ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_rota ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_classe ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_endereco ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_produto ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.ds_produto ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qt_produto ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qt_separado ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qt_cancelado ?? "-"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{l.qtd_pendente ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.cd_funcionario ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nm_funcionario ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.data_separacao ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.status_separacao ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nu_separacao ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.nu_contenedor ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.ds_onda ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          disabled={pagina === 1}
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-muted-foreground">Página {pagina}</span>
        <button
          disabled={!linhas || linhas.length < porPagina}
          onClick={() => setPagina((p) => p + 1)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          Próxima
        </button>
      </div>

      {confirmandoLimpeza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card border border-border p-5 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Limpar Dados do Dia?</h2>
            <p className="text-sm text-muted-foreground">
              Isso remove apenas os registros da área temporária (staging). Separador, auditorias, fotos e
              observações já persistidos no Acompanhamento NÃO serão afetados.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmandoLimpeza(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLimpeza}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
