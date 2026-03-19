/**
 * NEUPSILIN ADULTO â€” Tabelas Normativas
 * ReferÃªncia: Fonseca, R.P., Salles, J.F., & Parente, M.A.M.P. (2009).
 *             NEUPSILIN â€” Instrumento de AvaliaÃ§Ã£o NeuropsicolÃ³gica Breve. Vetor Editora.
 *
 * ATENÃ‡ÃƒO: Os valores de mÃ©dia e DP abaixo sÃ£o estimativas para funcionamento do sistema.
 * Substitua pelos dados oficiais do Manual (Vetor Editora) quando disponÃ­veis.
 *
 * Normas estratificadas por Escolaridade Ã— Faixa EtÃ¡ria:
 *   Escolaridades : "baixa" (0â€“4 anos) | "media" (5â€“11 anos) | "alta" (12+ anos)
 *   Faixas etÃ¡rias: "12-18" | "19-25" | "26-35" | "36-49" | "50-64" | "65+"
 *
 * Para adolescentes (12â€“18 anos), o NEUPSILIN possui normas em escore Z especÃ­ficas.
 * Para adultos (19â€“90 anos), as normas sÃ£o estratificadas por idade e escolaridade.
 */

const NEUPSILIN_META = {
  id:      "neupsilin-adulto",
  versao:  "2009_BR",
  fonte:   "Fonseca, R.P., Salles, J.F. & Parente, M.A.M.P. (2009). NEUPSILIN. Vetor Editora.",
  tipo:    "estimada",
  nota:    "Media/DP sao estimativas. Substituir pelos dados do Manual Vetor Editora."
};

const NEUPSILIN_NORMAS = {
  orientacao: {
    baixa: { "12-18":{media:5.5,dp:0.9}, "19-25":{media:5.2,dp:1.1}, "26-35":{media:5.3,dp:1.0}, "36-49":{media:5.1,dp:1.1}, "50-64":{media:4.8,dp:1.3}, "65+":{media:4.5,dp:1.4} },
    media: { "12-18":{media:5.8,dp:0.5}, "19-25":{media:5.7,dp:0.6}, "26-35":{media:5.8,dp:0.5}, "36-49":{media:5.6,dp:0.7}, "50-64":{media:5.4,dp:0.9}, "65+":{media:5.1,dp:1.1} },
    alta:  { "12-18":{media:5.9,dp:0.3}, "19-25":{media:5.9,dp:0.3}, "26-35":{media:5.9,dp:0.3}, "36-49":{media:5.9,dp:0.3}, "50-64":{media:5.7,dp:0.6}, "65+":{media:5.5,dp:0.8} }
  },
  atencao: {
    baixa: { "12-18":{media:20.5,dp:4.0}, "19-25":{media:16.8,dp:4.2}, "26-35":{media:16.2,dp:4.5}, "36-49":{media:15.1,dp:4.8}, "50-64":{media:13.2,dp:5.0}, "65+":{media:11.5,dp:5.1} },
    media: { "12-18":{media:25.0,dp:3.5}, "19-25":{media:20.4,dp:3.8}, "26-35":{media:19.9,dp:3.9}, "36-49":{media:18.7,dp:4.1}, "50-64":{media:16.5,dp:4.5}, "65+":{media:14.2,dp:4.9} },
    alta:  { "12-18":{media:28.5,dp:2.8}, "19-25":{media:24.1,dp:3.1}, "26-35":{media:23.7,dp:3.2}, "36-49":{media:22.5,dp:3.5}, "50-64":{media:20.1,dp:3.9}, "65+":{media:17.8,dp:4.3} }
  },
  percepcao: {
    baixa: { "12-18":{media:15.5,dp:2.8}, "19-25":{media:13.5,dp:3.1}, "26-35":{media:13.3,dp:3.2}, "36-49":{media:12.8,dp:3.4}, "50-64":{media:11.9,dp:3.6}, "65+":{media:10.8,dp:3.9} },
    media: { "12-18":{media:17.8,dp:2.2}, "19-25":{media:16.2,dp:2.5}, "26-35":{media:16.0,dp:2.6}, "36-49":{media:15.5,dp:2.8}, "50-64":{media:14.3,dp:3.1}, "65+":{media:12.9,dp:3.5} },
    alta:  { "12-18":{media:19.0,dp:1.5}, "19-25":{media:18.1,dp:1.9}, "26-35":{media:17.9,dp:2.0}, "36-49":{media:17.4,dp:2.2}, "50-64":{media:16.2,dp:2.6}, "65+":{media:14.7,dp:3.1} }
  },
  memoria: {
    baixa: { "12-18":{media:22.0,dp:4.8}, "19-25":{media:18.4,dp:5.2}, "26-35":{media:17.9,dp:5.4}, "36-49":{media:16.5,dp:5.7}, "50-64":{media:14.3,dp:6.0}, "65+":{media:12.1,dp:6.2} },
    media: { "12-18":{media:27.5,dp:4.2}, "19-25":{media:23.1,dp:4.6}, "26-35":{media:22.6,dp:4.7}, "36-49":{media:21.2,dp:5.0}, "50-64":{media:18.7,dp:5.5}, "65+":{media:15.9,dp:5.9} },
    alta:  { "12-18":{media:31.5,dp:3.5}, "19-25":{media:27.8,dp:3.9}, "26-35":{media:27.3,dp:4.0}, "36-49":{media:25.8,dp:4.3}, "50-64":{media:22.9,dp:4.8}, "65+":{media:19.6,dp:5.4} }
  },
  habilidades: {
    baixa: { "12-18":{media:6.5,dp:1.8}, "19-25":{media:5.2,dp:2.1}, "26-35":{media:5.0,dp:2.2}, "36-49":{media:4.7,dp:2.3}, "50-64":{media:4.1,dp:2.5}, "65+":{media:3.5,dp:2.6} },
    media: { "12-18":{media:8.2,dp:1.5}, "19-25":{media:7.1,dp:1.8}, "26-35":{media:6.9,dp:1.9}, "36-49":{media:6.5,dp:2.0}, "50-64":{media:5.9,dp:2.2}, "65+":{media:5.1,dp:2.5} },
    alta:  { "12-18":{media:9.4,dp:1.0}, "19-25":{media:8.8,dp:1.2}, "26-35":{media:8.6,dp:1.3}, "36-49":{media:8.2,dp:1.5}, "50-64":{media:7.5,dp:1.8}, "65+":{media:6.6,dp:2.1} }
  },
  linguagem: {
    baixa: { "12-18":{media:22.5,dp:4.8}, "19-25":{media:18.5,dp:5.1}, "26-35":{media:18.1,dp:5.2}, "36-49":{media:17.3,dp:5.4}, "50-64":{media:15.7,dp:5.7}, "65+":{media:13.9,dp:5.9} },
    media: { "12-18":{media:27.0,dp:4.0}, "19-25":{media:23.4,dp:4.4}, "26-35":{media:22.9,dp:4.5}, "36-49":{media:21.8,dp:4.8}, "50-64":{media:19.7,dp:5.1}, "65+":{media:17.4,dp:5.6} },
    alta:  { "12-18":{media:30.5,dp:3.0}, "19-25":{media:28.1,dp:3.5}, "26-35":{media:27.7,dp:3.6}, "36-49":{media:26.3,dp:3.9}, "50-64":{media:23.9,dp:4.4}, "65+":{media:21.1,dp:4.9} }
  },
  funcoes: {
    baixa: { "12-18":{media:15.0,dp:3.5}, "19-25":{media:12.1,dp:3.8}, "26-35":{media:11.8,dp:3.9}, "36-49":{media:11.0,dp:4.1}, "50-64":{media:9.7,dp:4.4}, "65+":{media:8.3,dp:4.6} },
    media: { "12-18":{media:18.5,dp:3.0}, "19-25":{media:15.6,dp:3.4}, "26-35":{media:15.2,dp:3.5}, "36-49":{media:14.4,dp:3.7}, "50-64":{media:12.7,dp:4.0}, "65+":{media:10.9,dp:4.4} },
    alta:  { "12-18":{media:22.0,dp:2.5}, "19-25":{media:19.2,dp:2.9}, "26-35":{media:18.8,dp:3.0}, "36-49":{media:17.9,dp:3.2}, "50-64":{media:15.8,dp:3.7}, "65+":{media:13.5,dp:4.1} }
  },
  praxias: {
    baixa: { "12-18":{media:14.5,dp:3.0}, "19-25":{media:12.3,dp:3.5}, "26-35":{media:12.0,dp:3.6}, "36-49":{media:11.3,dp:3.8}, "50-64":{media:10.1,dp:4.1}, "65+":{media:8.8,dp:4.3} },
    media: { "12-18":{media:17.0,dp:2.5}, "19-25":{media:15.1,dp:3.0}, "26-35":{media:14.8,dp:3.1}, "36-49":{media:14.1,dp:3.3}, "50-64":{media:12.5,dp:3.7}, "65+":{media:10.7,dp:4.1} },
    alta:  { "12-18":{media:18.8,dp:1.8}, "19-25":{media:17.5,dp:2.3}, "26-35":{media:17.2,dp:2.4}, "36-49":{media:16.5,dp:2.6}, "50-64":{media:14.8,dp:3.1}, "65+":{media:12.9,dp:3.6} }
  }
};

/* Escores mÃ¡ximos por Ã¡rea */
const MAX_SCORES = {
  orientacao: 6,
  atencao:    32,
  percepcao:  20,
  memoria:    36,
  habilidades:10,
  linguagem:  33,
  funcoes:    26,
  praxias:    20
};

/* Nomes de exibiÃ§Ã£o */
const AREA_NOMES = {
  orientacao:  "OrientaÃ§Ã£o TÃªmporo-Espacial",
  atencao:     "AtenÃ§Ã£o",
  percepcao:   "PercepÃ§Ã£o Visual",
  memoria:     "MemÃ³ria",
  habilidades: "CÃ¡lculo",
  linguagem:   "Linguagem",
  funcoes:     "FunÃ§Ãµes Executivas",
  praxias:     "Praxias"
};

/* Sub-nomes */
const SUB_NOMES = {
  dia_semana:"Dia da semana", dia_mes:"Dia do mÃªs", mes:"MÃªs", ano:"Ano", local:"Local", cidade:"Cidade",
  digitos_direto:"DÃ­gitos â€” Ordem Direta", digitos_inverso:"DÃ­gitos â€” Ordem Inversa", cancelamento:"Cancelamento de Letras",
  nomeacao:"NomeaÃ§Ã£o de Figuras", discriminacao:"DiscriminaÃ§Ã£o de Figuras",
  trabalho_verbal:"MemÃ³ria de Trabalho Verbal", evocacao_imediata:"EvocaÃ§Ã£o Imediata", evocacao_tardia:"EvocaÃ§Ã£o Tardia", reconhecimento:"Reconhecimento", semantica:"MemÃ³ria SemÃ¢ntica",
  calculo_mental:"CÃ¡lculo Mental", problemas:"Problemas AritmÃ©ticos",
  fluencia:"FluÃªncia Verbal", compreensao_oral:"CompreensÃ£o Oral", repeticao:"RepetiÃ§Ã£o", leitura:"Leitura", escrita:"Escrita",
  fluencia_fonemica:"FluÃªncia FonÃªmica", controle_inibitorico:"Controle InibitÃ³rio", resolucao_problemas:"ResoluÃ§Ã£o de Problemas", abstracao:"AbstraÃ§Ã£o Verbal",
  construtiva:"Praxia Construtiva", ideomotora:"Praxia Ideomotora"
};

/** Retorna faixa etÃ¡ria para acesso Ã s normas do NEUPSILIN Adulto (12â€“90 anos) */
function getFaixaEtaria(idade) {
  if (idade <= 18) return "12-18";
  if (idade <= 25) return "19-25";
  if (idade <= 35) return "26-35";
  if (idade <= 49) return "36-49";
  if (idade <= 64) return "50-64";
  return "65+";
}

/**
 * Classifica escore-Z em categoria qualitativa.
 * CritÃ©rios baseados em percentis (1 dp = ~16th, 1,5 dp = ~7th etc.)
 */
function classificarZ(z) {
  if (z >= 1.0)  return { label: "Superior",         badge: "badge-superior", interp: "desempenho acima do esperado para o grupo de referÃªncia" };
  if (z >= 0.5)  return { label: "MÃ©dio-Superior",   badge: "badge-medio-sup", interp: "desempenho levemente acima da mÃ©dia" };
  if (z >= -0.5) return { label: "MÃ©dio",             badge: "badge-medio", interp: "desempenho dentro da mÃ©dia esperada" };
  if (z >= -1.0) return { label: "MÃ©dio-Inferior",   badge: "badge-medio-inf", interp: "desempenho levemente abaixo da mÃ©dia â€” acompanhamento recomendado" };
  return           { label: "Inferior",              badge: "badge-inferior", interp: "desempenho significativamente abaixo da mÃ©dia â€” avaliaÃ§Ã£o aprofundada indicada" };
}

/**
 * Calcula escore-Z para uma Ã¡rea.
 * @param {string} area - chave da Ã¡rea
 * @param {number} score - pontuaÃ§Ã£o bruta
 * @param {string} escolaridade - "baixa"|"media"|"alta"
 * @param {number} idade - em anos
 * @returns {{ z: number, classe: object, media: number, dp: number }}
 */
/**
 * Calcula escore-Z para uma Ã¡rea.
 *
 * normalizacaoUsada:
 *  "real"    â€” quando os dados oficiais do manual estiverem inseridos (futuro)
 *  "estimada" â€” enquanto os valores sÃ£o aproximaÃ§Ãµes (estado atual)
 *
 * Para inserir os dados reais do manual, substitua os valores de mÃ©dia e DP
 * nas tabelas NORMAS acima pelas normas oficiais da Vetor Editora.
 */
function calcularZArea(area, score, escolaridade, idade) {
  const faixa = getFaixaEtaria(idade);
  const norma = NEUPSILIN_NORMAS[area]?.[escolaridade]?.[faixa];
  if (!norma) return { z: 0, classe: classificarZ(0), media: 0, dp: 1, normalizacaoUsada: "indisponivel" };
  const z = (score - norma.media) / norma.dp;
  // Altere para "real" apÃ³s inserir os dados oficiais do Manual
  const normalizacaoUsada = "estimada";
  return { z: +z.toFixed(2), classe: classificarZ(z), media: norma.media, dp: norma.dp, normalizacaoUsada };
}

/**
 * ClassificaÃ§Ã£o geral pela mÃ©dia dos z-scores de todas as Ã¡reas.
 */
function classificacaoGeral(zScores) {
  const media = zScores.reduce((a, b) => a + b, 0) / zScores.length;
  return classificarZ(media);
}

