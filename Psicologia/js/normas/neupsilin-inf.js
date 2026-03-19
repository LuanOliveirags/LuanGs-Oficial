/**
 * NEUPSILIN-INF — Tabelas Normativas
 * Referência: Salles, J.F., Fonseca, R.P., Cruz-Rodrigues, C., Mello, C.B., Barbosa, T.,
 *             & Miranda, M.C. (2011). Desenvolvimento do Instrumento de Avaliação
 *             Neuropsicológica Breve Infantil NEUPSILIN-Inf. Vetor Editora.
 *
 * Normas estratificadas por FAIXA ETÁRIA (ano a ano: 6–12 anos).
 * Aplicável a crianças de 6 anos a 12 anos e 11 meses (1º ao 6º ano do EF).
 *
 * ATENÇÃO: As normas oficiais do NEUPSILIN-INF levam em conta também Tipo de Escola
 * (pública/particular) e Região Geográfica. As tabelas abaixo são referências gerais
 * por faixa etária. Para estratificação completa, consulte o Manual oficial (Vetor Editora).
 *
 * Faixas: "6" | "7" | "8" | "9" | "10" | "11" | "12"
 *
 * Escores máximos por área (26 subtestes — versão infantil):
 *   Orientação Têmporo-Espacial   : 6
 *   Atenção                       : 22
 *   Percepção Visual              : 20
 *   Memória                       : 30
 *   Hab. Aritméticas              : 8
 *   Linguagem                     : 26
 *   Funções Executivas            : 18
 *   Habilidades Visuoconstrutivas : 16
 *   TOTAL                         : 146
 */

const NEUPSILIN_INF_META = {
  id:      "neupsilin-inf",
  versao:  "2011_BR",
  fonte:   "Salles, J.F. et al. (2011). NEUPSILIN-Inf. Vetor Editora.",
  tipo:    "estimada",
  nota:    "Estratificacao: faixa etaria x tipo escola x regiao. Consultar Manual Vetor Editora."
};

const NORMAS_INF = {
  orientacao: {
    "6":  { media: 3.5, dp: 1.2 },
    "7":  { media: 4.1, dp: 1.1 },
    "8":  { media: 4.7, dp: 1.0 },
    "9":  { media: 5.1, dp: 0.9 },
    "10": { media: 5.3, dp: 0.8 },
    "11": { media: 5.5, dp: 0.7 },
    "12": { media: 5.7, dp: 0.5 }
  },
  atencao: {
    "6":  { media: 7.8,  dp: 2.9 },
    "7":  { media: 9.8,  dp: 2.7 },
    "8":  { media: 11.8, dp: 2.6 },
    "9":  { media: 13.5, dp: 2.5 },
    "10": { media: 15.2, dp: 2.4 },
    "11": { media: 16.8, dp: 2.3 },
    "12": { media: 18.1, dp: 2.2 }
  },
  percepcao: {
    "6":  { media: 10.0, dp: 2.6 },
    "7":  { media: 11.8, dp: 2.5 },
    "8":  { media: 13.4, dp: 2.3 },
    "9":  { media: 14.9, dp: 2.2 },
    "10": { media: 16.1, dp: 2.0 },
    "11": { media: 17.1, dp: 1.8 },
    "12": { media: 17.9, dp: 1.6 }
  },
  memoria: {
    "6":  { media: 11.5, dp: 3.6 },
    "7":  { media: 14.0, dp: 3.4 },
    "8":  { media: 16.5, dp: 3.3 },
    "9":  { media: 18.8, dp: 3.2 },
    "10": { media: 20.8, dp: 3.0 },
    "11": { media: 22.5, dp: 2.8 },
    "12": { media: 24.2, dp: 2.7 }
  },
  habilidades: {
    "6":  { media: 2.5, dp: 1.2 },
    "7":  { media: 3.3, dp: 1.2 },
    "8":  { media: 4.2, dp: 1.1 },
    "9":  { media: 5.0, dp: 1.0 },
    "10": { media: 5.8, dp: 1.0 },
    "11": { media: 6.3, dp: 0.9 },
    "12": { media: 6.9, dp: 0.8 }
  },
  linguagem: {
    "6":  { media: 11.5, dp: 3.3 },
    "7":  { media: 13.9, dp: 3.2 },
    "8":  { media: 16.3, dp: 3.0 },
    "9":  { media: 18.5, dp: 2.9 },
    "10": { media: 20.4, dp: 2.8 },
    "11": { media: 21.9, dp: 2.5 },
    "12": { media: 23.3, dp: 2.3 }
  },
  funcoes: {
    "6":  { media: 6.0,  dp: 2.3 },
    "7":  { media: 7.6,  dp: 2.2 },
    "8":  { media: 9.2,  dp: 2.1 },
    "9":  { media: 10.8, dp: 2.0 },
    "10": { media: 12.3, dp: 1.9 },
    "11": { media: 13.6, dp: 1.8 },
    "12": { media: 14.9, dp: 1.6 }
  },
  praxias: {
    "6":  { media: 7.2,  dp: 2.3 },
    "7":  { media: 8.7,  dp: 2.2 },
    "8":  { media: 10.2, dp: 2.1 },
    "9":  { media: 11.6, dp: 2.0 },
    "10": { media: 12.7, dp: 1.8 },
    "11": { media: 13.6, dp: 1.7 },
    "12": { media: 14.5, dp: 1.5 }
  }
};

/* Escores máximos por área — NEUPSILIN-INF */
const MAX_SCORES_INF = {
  orientacao:  6,
  atencao:     22,
  percepcao:   20,
  memoria:     30,
  habilidades: 8,
  linguagem:   26,
  funcoes:     18,
  praxias:     16
};

/* Nomes das áreas — INF */
const AREA_NOMES_INF = {
  orientacao:  "Orientação Têmporo-Espacial",
  atencao:     "Atenção",
  percepcao:   "Percepção Visual",
  memoria:     "Memória",
  habilidades: "Habilidades Aritméticas",
  linguagem:   "Linguagem",
  funcoes:     "Funções Executivas",
  praxias:     "Habilidades Visuoconstrutivas"
};

/* Nomes dos subtestes — INF */
const SUB_NOMES_INF = {
  /* Orientação */
  inf_dia_semana: "Dia da semana", inf_dia_mes: "Dia do mês",
  inf_mes: "Mês", inf_ano: "Ano", inf_local: "Local", inf_cidade: "Cidade",
  /* Atenção */
  inf_digitos_direto:  "Dígitos — Ordem Direta",
  inf_digitos_inverso: "Dígitos — Ordem Inversa",
  inf_cancelamento:    "Cancelamento de Figuras",
  /* Percepção */
  inf_nomeacao:    "Nomeação de Figuras",
  inf_discriminacao: "Discriminação Visual",
  /* Memória */
  inf_trabalho_verbal: "Memória de Trabalho Verbal",
  inf_evocacao_imediata: "Evocação Imediata",
  inf_evocacao_tardia:   "Evocação Tardia",
  inf_reconhecimento:    "Reconhecimento",
  inf_semantica:         "Memória Semântica",
  /* Habilidades */
  inf_calculo:   "Cálculo Simples",
  inf_problemas: "Problemas Aritméticos",
  /* Linguagem */
  inf_fluencia:        "Fluência Verbal (categorias)",
  inf_compreensao_oral:"Compreensão Oral",
  inf_repeticao:       "Repetição de Palavras",
  inf_leitura:         "Leitura",
  inf_escrita:         "Escrita / Ditado",
  /* Funções Executivas */
  inf_fluencia_fonemica:     "Fluência Fonêmica (letra P)",
  inf_controle_inibitorico:  "Controle Inibitório",
  inf_resolucao_problemas:   "Resolução de Problemas",
  inf_abstracao:             "Abstração",
  /* Praxias */
  inf_construtiva: "Praxia Construtiva",
  inf_ideomotora:  "Praxia Ideomotora"
};

/**
 * Retorna faixa etária (ano exato) para NEUPSILIN-INF.
 * Suporta idades de 6 a 12 anos (6 a 12 anos e 11 meses).
 */
function getFaixaEtariaInf(idadeAnos) {
  if (idadeAnos < 6)  return "6";
  if (idadeAnos > 12) return "12";
  return String(idadeAnos);
}

/**
 * Calcula z-score para uma área do NEUPSILIN-INF.
 *
 * Prioridade de busca (da mais para a menos específica):
 *  1. Norma completa  →  chave "idade_tipoescola_regiao"  (ex: "8_publica_sul")
 *  2. Fallback        →  chave "idade"                    (ex: "8")
 *
 * Quando as normas estratificadas do manual forem inseridas em NORMAS_INF,
 * o sistema usará automaticamente a norma completa para cada criança.
 *
 * Como adicionar as normas completas em NORMAS_INF (para cada área):
 *   "8_publica_sul":        { media: X.X, dp: X.X },
 *   "8_particular_sudeste": { media: X.X, dp: X.X },
 *   ...
 *
 *   Chave = "IDADE_TIPOESCOLA_REGIAO"
 *   Tipos de escola : publica | particular
 *   Regiões         : norte | nordeste | centro_oeste | sudeste | sul
 *   Idades          : 6 | 7 | 8 | 9 | 10 | 11 | 12
 *
 * @param {string} area       - chave da área (ex: "orientacao")
 * @param {number} score      - escore bruto obtido
 * @param {number} idadeAnos  - idade em anos completos
 * @param {string} [tipoEscola] - "publica" | "particular"
 * @param {string} [regiao]     - "norte" | "nordeste" | "centro_oeste" | "sudeste" | "sul"
 * @returns {{ z, media, dp, classe, normalizacaoUsada }}
 */
function calcularZAreaInf(area, score, idadeAnos, tipoEscola = "", regiao = "") {
  const faixa = getFaixaEtariaInf(idadeAnos);

  // 1ª tentativa: norma completa (idade × tipo de escola × região)
  const chaveCompleta = tipoEscola && regiao ? `${faixa}_${tipoEscola}_${regiao}` : null;
  const normaCompleta = chaveCompleta ? NORMAS_INF[area]?.[chaveCompleta] : null;

  // 2ª tentativa: fallback por idade apenas
  const normaFallback = NORMAS_INF[area]?.[faixa];

  const norma = normaCompleta ?? normaFallback;
  const normalizacaoUsada = normaCompleta ? "completa" : "parcial_idade";

  if (!norma) return { z: 0, media: 0, dp: 1, classe: classificarZ(0), normalizacaoUsada: "indisponivel" };

  const z = (score - norma.media) / norma.dp;
  return { z: +z.toFixed(2), media: norma.media, dp: norma.dp, classe: classificarZ(z), normalizacaoUsada };
}

