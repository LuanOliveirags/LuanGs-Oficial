/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/normas-loader.js
   Carregamento seguro de tabelas normativas do Firestore.

   Fluxo de proteção:
   1. App carrega → normas/*.js contém funções e META mas NÃO tabelas
   2. Usuário faz login → carregarNormas() busca _normas/tabelas no Firestore
   3. Se encontrado  → tabelas do servidor sobrepõem o bundle (getters em normas/index.js)
   4. Se não encontrado → fallback transparente para dados do bundle local
   5. Ao sair → limparNormasMemoria() descarta as tabelas em memória

   Coleção Firestore: _normas  (regras: read = auth, write = false)

   Para popular o Firestore pela primeira vez:
     await seedNormasFirestore()   ← console de admin, UMA VEZ
   Após a seed, remova os dados de tabelas dos normas/*.js
   para que não sejam distribuídos no bundle público.
═══════════════════════════════════════════════════════ */

// null   = ainda não tentou carregar (antes do login)
// {}     = carregado mas servidor sem dados (usa bundle)
// {...}  = tabelas do servidor prontas
let _servidor = null;

/**
 * Busca tabelas normativas do Firestore após login bem-sucedido.
 * Chamado automaticamente por core/auth.js → fazerLogin / session restore.
 * @returns {Promise<void>}
 */
async function carregarNormas() {
  try {
    const doc = await _firestoreDB.collection("_normas").doc("tabelas").get();
    if (doc.exists) {
      _servidor = doc.data();
      console.info("[normas] ✓ Tabelas carregadas do servidor.");
    } else {
      _servidor = {};
      console.info("[normas] Servidor sem dados — usando bundle local como fallback.");
    }
  } catch (e) {
    _servidor = {};
    console.warn("[normas] Fallback bundle (Firestore indisponível):", e.message);
  }
}

/**
 * Descarta tabelas da memória ao fazer logout.
 * Chamado por core/auth.js → fazerLogout().
 */
function limparNormasMemoria() {
  _servidor = null;
}

/**
 * Retorna as tabelas carregadas do servidor (usadas pelos getters em normas/index.js).
 * @returns {object|null}
 */
function getServidorNormas() {
  return _servidor;
}

/**
 * Indica se as tabelas já foram buscadas (independente de ter dados ou não).
 * @returns {boolean}
 */
function normasCarregadas() {
  return _servidor !== null;
}

/**
 * Admin: popula o Firestore com as tabelas do bundle local.
 *
 * Executar UMA VEZ no console, logado como admin:
 *   await seedNormasFirestore()
 *
 * Após confirmar que o Firestore contém os dados, remova os objetos de tabelas
 * dos arquivos normas/*.js (WISC_NORMAS, NEUPSILIN_NORMAS, NORMAS_INF,
 * BFP_NORMAS_FACETA) para que não sejam distribuídos no bundle público.
 *
 * @returns {Promise<boolean>}
 */
async function seedNormasFirestore() {
  if (!window.usuarioLogado || window.usuarioLogado.role !== "admin") {
    throw new Error("[normas] Apenas administradores podem executar a seed.");
  }

  // Verifica se os globals do bundle ainda estão disponíveis
  const requeridos = [
    ["WISC_NORMAS",         "normas/wisc.js"],
    ["NEUPSILIN_NORMAS",    "normas/neupsilin.js"],
    ["NORMAS_INF",          "normas/neupsilin-inf.js"],
    ["BFP_NORMAS_FACETA",   "normas/bfp.js"]
  ];
  for (const [varName, arquivo] of requeridos) {
    if (typeof window[varName] === "undefined") {
      throw new Error(`[normas] "${varName}" não encontrado. Certifique-se que ${arquivo} está carregado.`);
    }
  }

  const payload = {
    wisc:             WISC_NORMAS,
    neupsilin:        NEUPSILIN_NORMAS,
    "neupsilin-inf":  NORMAS_INF,
    bfp:              BFP_NORMAS_FACETA,
    _seedAt:          new Date().toISOString(),
    _seedPor:         window.usuarioLogado.email,
    _versao:          "1.0"
  };

  await _firestoreDB.collection("_normas").doc("tabelas").set(payload);
  _servidor = payload; // atualiza memória imediatamente

  console.info("═══════════════════════════════════════════════════");
  console.info("[normas] ✓ Seed concluído! Tabelas salvas no Firestore.");
  console.info("[normas] Próximo passo: remova os objetos de tabelas dos");
  console.info("         arquivos normas/*.js para proteger o bundle.");
  console.info("         Variáveis a remover: WISC_NORMAS, NEUPSILIN_NORMAS,");
  console.info("         NORMAS_INF, BFP_NORMAS_FACETA");
  console.info("═══════════════════════════════════════════════════");
  return true;
}
