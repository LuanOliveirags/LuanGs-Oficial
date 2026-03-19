/* ═══════════════════════════════════════════════════════
   PsiCorrection — js/normas/index.js
   Fonte de verdade dos dados normativos.

   Arquitetura de proteção em camadas:
     Nível 1 (bundle): normas/*.js contém funções e META.
     Nível 2 (runtime): tabelas só ficam na memória APÓS login.
     Nível 3 (servidor): tabelas migradas pro Firestore sobrepõem
                          o bundle via getter → getServidorNormas().

   Uso:
     const { wisc }      = NORMAS;
     wisc.tabelas        → prioriza Firestore, fallback no bundle
     NORMAS.meta("wisc") → { id, versao, fonte, tipo, nota }

   Seed Firestore (admin, 1x apenas):
     await seedNormasFirestore()
═══════════════════════════════════════════════════════ */

// ── Ponto de acesso unificado ─────────────────────────
// As propriedade `tabelas` são GETTERS: preferem Firestore,
// fazem fallback no bundle se o servidor ainda não foi seeded.
const NORMAS = Object.freeze({

  /* ─── WISC-IV ─────────────────────────────────────── */
  wisc: {
    meta:               WISC_META,
    get tabelas()       { return getServidorNormas()?.wisc ?? WISC_NORMAS; },
    indices:            WISC_INDICES,
    subtestesPorIndice: WISC_SUBTESTES_POR_INDICE,
    subNomes:           WISC_SUB_NOMES,
    calcularIndice:     calcularIndiceWISC,
    classificarQI:      classificarQI
  },

  /* ─── NEUPSILIN Adulto ────────────────────────────── */
  neupsilin: {
    meta:               NEUPSILIN_META,
    get tabelas()       { return getServidorNormas()?.neupsilin ?? NEUPSILIN_NORMAS; },
    maxScores:          MAX_SCORES,
    areaNomes:          AREA_NOMES,
    subNomes:           SUB_NOMES,
    getFaixaEtaria:     getFaixaEtaria,
    classificarZ:       classificarZ,
    calcularZArea:      calcularZArea,
    classificacaoGeral: classificacaoGeral
  },

  /* ─── NEUPSILIN-INF ───────────────────────────────── */
  "neupsilin-inf": {
    meta:           NEUPSILIN_INF_META,
    get tabelas()   { return getServidorNormas()?.["neupsilin-inf"] ?? NORMAS_INF; },
    maxScores:      MAX_SCORES_INF,
    areaNomes:      AREA_NOMES_INF,
    subNomes:       SUB_NOMES_INF,
    getFaixaEtaria: getFaixaEtariaInf,
    calcularZArea:  calcularZAreaInf
  },

  /* ─── BFP ─────────────────────────────────────────── */
  bfp: {
    meta:           BFP_META,
    get tabelas()   { return getServidorNormas()?.bfp ?? BFP_NORMAS_FACETA; },
    fatores:        BFP_FATORES,
    facetas:        BFP_FACETAS,
    tScore:         bfpTScore,
    percentil:      bfpPercentil,
    classificar:    bfpClassificar,
    badgeCor:       bfpBadgeCor,
    classeGenerica: bfpClasseGenerica
  },

  /**
   * Retorna o metadado de versionamento de um instrumento.
   * @param {"wisc"|"neupsilin"|"neupsilin-inf"|"bfp"} id
   * @returns {{ versao, fonte, tipo, nota }}
   */
  meta(id) { return this[id]?.meta ?? null; }

});

// ── Acesso admin para seed ────────────────────────────
// `const` não vai para `window`, então expomos explicitamente.
// seedNormasFirestore() usa este objeto para popular o Firestore.
window._getNormasBundleCompleto = function () {
  return {
    wisc:            WISC_NORMAS,
    neupsilin:       NEUPSILIN_NORMAS,
    "neupsilin-inf": NORMAS_INF,
    bfp:             BFP_NORMAS_FACETA
  };
};
