// ─────────────────────────────────────────────────────────
// WISC-IV — Normas simuladas (baseadas em Wechsler, 2013)
// ─────────────────────────────────────────────────────────

/** Nomes dos índices */
const WISC_INDICES = {
  cv: "Compreensão Verbal",
  rp: "Raciocínio Perceptual",
  mt: "Memória de Trabalho",
  vp: "Velocidade de Processamento"
};

/**
 * Médias e DPs esperados da SOMA de escores ponderados por índice.
 * (Escores ponderados: média=10, dp≈3 por subteste)
 * CV = 3 subtestes → media≈30, dp≈6
 * RP = 3 subtestes → media≈30, dp≈6
 * MT = 2 subtestes → media≈20, dp≈4.5
 * VP = 2 subtestes → media≈20, dp≈4.5
 */
const WISC_NORMAS = {
  cv: { media: 30, dp: 6.0 },
  rp: { media: 30, dp: 6.0 },
  mt: { media: 20, dp: 4.5 },
  vp: { media: 20, dp: 4.5 }
};

/** Subtestes por índice */
const WISC_SUBTESTES_POR_INDICE = {
  cv: ["semelhancas", "vocabulario", "compreensao"],
  rp: ["cubos", "conceitos_fig", "matrizes"],
  mt: ["digitos", "sequencia_ln"],
  vp: ["codigo", "procurar_simbolos"]
};

/** Nomes de exibição dos subtestes WISC */
const WISC_SUB_NOMES = {
  semelhancas:       "Semelhanças",
  vocabulario:       "Vocabulário",
  compreensao:       "Compreensão",
  cubos:             "Cubos",
  conceitos_fig:     "Conceitos Figurados",
  matrizes:          "Raciocínio com Matrizes",
  digitos:           "Dígitos",
  sequencia_ln:      "Sequência de Letras-Números",
  codigo:            "Código",
  procurar_simbolos: "Procurar Símbolos"
};

/**
 * Converte soma de escores ponderados em escore de índice (EI).
 * EI = 100 + 15 × (soma − média) / dp, clampado a [40, 160].
 */
function calcularIndiceWISC(soma, indice) {
  const norma = WISC_NORMAS[indice];
  if (!norma) return 100;
  return Math.max(40, Math.min(160, Math.round(100 + 15 * (soma - norma.media) / norma.dp)));
}

/** Classifica um Escore de Índice ou QI Total do WISC (escala 40–160). */
function classificarQI(qi) {
  if (qi >= 130) return { label: "Muito Superior",              badge: "badge-superior",   interp: "desempenho muito acima da média para a faixa etária" };
  if (qi >= 120) return { label: "Superior",                    badge: "badge-superior",   interp: "desempenho acima da média para a faixa etária" };
  if (qi >= 110) return { label: "Médio-Superior",              badge: "badge-medio-sup",  interp: "desempenho levemente acima da média" };
  if (qi >= 90)  return { label: "Médio",                       badge: "badge-medio",      interp: "desempenho dentro da média esperada" };
  if (qi >= 80)  return { label: "Médio-Inferior",              badge: "badge-medio-inf",  interp: "desempenho levemente abaixo da média" };
  if (qi >= 70)  return { label: "Limítrofe",                   badge: "badge-inferior",   interp: "desempenho abaixo da média — investigação recomendada" };
  return                 { label: "Intelectualmente Deficiente", badge: "badge-inferior",  interp: "desempenho significativamente abaixo da média — avaliação aprofundada indicada" };
}
