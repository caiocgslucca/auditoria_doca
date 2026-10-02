/**
 * Regra CENTRAL de calculo de "Qtde Contar".
 * Usada por: Coletor, Acompanhamento, Dashboard, Relatorios.
 * NUNCA duplicar esta logica em outro arquivo.
 *
 * Regra observada no legado:
 * - Classe ZCHP (paletizado/contenedor): a quantidade a contar é por
 *   contenedor (NU_CONTENEDOR), referência QT_SEPARADO.
 * - Demais classes: quantidade a contar é QT_PRODUTO (quantidade do pedido),
 *   descontando QT_CANCELADO quando aplicável.
 */
export interface LinhaParaQtdeContar {
  cd_classe: string | null;
  qt_produto: number | null;
  qt_separado: number | null;
  qt_cancelado: number | null;
  qtd_pendente: number | null;
  nu_contenedor: number | null;
}

export function calcularQtdeContar(linha: LinhaParaQtdeContar): number {
  const classe = (linha.cd_classe ?? "").trim().toUpperCase();
  const qtProduto = linha.qt_produto ?? 0;
  const qtSeparado = linha.qt_separado ?? 0;
  const qtCancelado = linha.qt_cancelado ?? 0;

  if (classe === "ZCHP") {
    // Paletizado/contenedor: conta-se o que foi efetivamente separado.
    return qtSeparado > 0 ? qtSeparado : qtProduto;
  }

  // Demais classes: produto pedido menos cancelado (nunca negativo).
  const base = qtProduto - qtCancelado;
  return base > 0 ? base : 0;
}

export function calcularDif(qtdeContar: number, qtdeContada: number | null): number | null {
  if (qtdeContada === null || qtdeContada === undefined) return null;
  return qtdeContada - qtdeContar;
}

export function calcularPercentualDif(qtdeContar: number, qtdeContada: number | null): number | null {
  if (qtdeContada === null || qtdeContada === undefined) return null;
  if (!qtdeContar || qtdeContar === 0) return null;
  return ((qtdeContada - qtdeContar) / qtdeContar) * 100;
}

export type StatusAuditoria =
  | "pendente"
  | "finalizado_sem_divergencia"
  | "finalizado_com_divergencia";

export function calcularStatus(qtdeContar: number, qtdeContada: number | null): StatusAuditoria {
  if (qtdeContada === null || qtdeContada === undefined) return "pendente";
  return qtdeContada === qtdeContar ? "finalizado_sem_divergencia" : "finalizado_com_divergencia";
}

export function formatarDif(dif: number | null): string {
  if (dif === null || dif === undefined) return "-";
  if (dif === 0) return "0";
  return dif > 0 ? `+${dif}` : `${dif}`;
}

export function formatarPercentualDif(pct: number | null): string {
  if (pct === null || pct === undefined) return "-";
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct.toFixed(2).replace(".", ",")}%`;
}

export function formatarMatriculaNome(matricula: string | number | null, nome: string | null): string {
  if (!matricula || !nome) return "-";
  return `${matricula} - ${nome}`;
}

export function labelStatus(status: StatusAuditoria | string | null): string {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "finalizado_sem_divergencia":
      return "Finalizado S/Dvg.";
    case "finalizado_com_divergencia":
      return "Finalizado C/Dvg.";
    default:
      return "-";
  }
}
