/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/normas-loader.js
   Carregamento seguro de tabelas normativas do Firestore.

   CAMADAS DE PROTEÇÃO:
   1. Bundle    : normas/*.js contém só funções e META (tabelas removidas após seed)
   2. Session   : carregarNormas() só chamado após login validado pela aplicação
   3. Firestore : regras verificam _sessoes/{uid}.role (não só request.auth)
   4. Cache     : tabelas cifradas em sessionStorage (AES-GCM, chave em memória)
   5. Auditoria : cada carregamento registrado em _audit (fire-and-forget)

   ESTRUTURA NO FIRESTORE:
     _normas/{instrumento}  →  { tabelas: {...}, _seedAt, _seedPor, _versao }
     _sessoes/{uid}         →  { role, email, validoAte }
     _audit/{autoId}        →  { uid, email, instrumentos, ts, ua }

   Para popular o Firestore pela primeira vez (admin, UMA VEZ):
     await seedNormasFirestore()
   Após confirmar dados no Firestore, remova os objetos de tabelas dos
   normas/*.js para que não sejam distribuídos no bundle público.
═══════════════════════════════════════════════════════ */

// null = pré-login | {} = carregado, servidor sem dados | {...} = tabelas prontas
let _servidor = null;
// CryptoKey AES-GCM gerada uma vez por sessão de login — NUNCA vai para storage
let _cacheKey = null;
const _SS_KEY = "psi_nc"; // chave no sessionStorage (valor: base64 cifrado)

// ── Criptografia de cache ─────────────────────────────

async function _initCacheKey() {
  if (_cacheKey) return _cacheKey;
  _cacheKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
  );
  return _cacheKey;
}

async function _criptografar(dados) {
  const chave   = await _initCacheKey();
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const bytes   = new TextEncoder().encode(JSON.stringify(dados));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, bytes);
  const out     = new Uint8Array(12 + cifrado.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cifrado), 12);
  return btoa(String.fromCharCode(...out));
}

async function _decriptarCache() {
  if (!_cacheKey) return null;
  const b64 = sessionStorage.getItem(_SS_KEY);
  if (!b64) return null;
  try {
    const buf     = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv      = buf.slice(0, 12);
    const cifrado = buf.slice(12);
    const claro   = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, _cacheKey, cifrado);
    return JSON.parse(new TextDecoder().decode(claro));
  } catch {
    sessionStorage.removeItem(_SS_KEY);
    return null;
  }
}

// ── Sessão Firestore (_sessoes) ───────────────────────

async function _registrarSessao(email, role) {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  const validoAte = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await _firestoreDB.collection("_sessoes").doc(uid)
    .set({ role, email, validoAte })
    .catch(console.error);
}

async function _removerSessao() {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  await _firestoreDB.collection("_sessoes").doc(uid)
    .delete()
    .catch(console.error);
}

// ── Auditoria ─────────────────────────────────────────

function _registrarAuditoria(email, instrumentos) {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  _firestoreDB.collection("_audit").add({
    uid, email, instrumentos,
    ts: new Date().toISOString(),
    ua: navigator.userAgent.slice(0, 150)
  }).catch(console.error); // fire-and-forget, nunca bloqueia UI
}

// ── API pública ───────────────────────────────────────

/**
 * Busca tabelas normativas do Firestore após login bem-sucedido.
 *
 * Fluxo:
 *   1. Registra _sessoes/{uid} → habilita leitura de _normas pelas regras Firestore
 *   2. Verifica cache cifrado em sessionStorage (evita nova busca no mesmo tab)
 *   3. Busca _normas/{instrumento} em paralelo (4 documentos)
 *   4. Cifra e armazena em sessionStorage (chave permanece apenas em memória)
 *   5. Registra acesso em _audit
 *
 * @param {string} email  - email do profissional autenticado
 * @param {string} role   - "profissional" | "admin"
 * @returns {Promise<void>}
 */
async function carregarNormas(email = "", role = "profissional") {
  // 1. Registrar sessão (habilita regras Firestore para _normas)
  await _registrarSessao(email, role);

  // 2. Verificar cache cifrado (reload no mesmo tab reutiliza dados)
  const cached = await _decriptarCache();
  if (cached) {
    _servidor = cached;
    console.info("[normas] ✓ Carregado do cache cifrado.");
    return;
  }

  // 3. Buscar 4 instrumentos em paralelo
  const ids = ["wisc", "neupsilin", "neupsilin-inf", "bfp"];
  const resultado = {};
  let algumEncontrado = false;

  try {
    const docs = await Promise.all(
      ids.map(id => _firestoreDB.collection("_normas").doc(id).get())
    );
    for (let i = 0; i < ids.length; i++) {
      if (docs[i].exists) {
        // Armazena só o campo `tabelas`, descartando metadados (_seedAt etc.)
        resultado[ids[i]] = docs[i].data().tabelas ?? docs[i].data();
        algumEncontrado = true;
      }
    }
  } catch (e) {
    _servidor = {};
    console.warn("[normas] Fallback bundle (Firestore indisponível):", e.message);
    return;
  }

  if (!algumEncontrado) {
    _servidor = {};
    console.info("[normas] Servidor sem dados — usando bundle local como fallback.");
    return;
  }

  _servidor = resultado;

  // 4. Cifrar e armazenar em sessionStorage
  try {
    sessionStorage.setItem(_SS_KEY, await _criptografar(_servidor));
  } catch (e) {
    console.warn("[normas] Cache cifrado indisponível:", e.message);
  }

  // 5. Auditoria (fire-and-forget)
  _registrarAuditoria(email, Object.keys(resultado));
  console.info("[normas] ✓ Tabelas carregadas:", Object.keys(resultado).join(", "));
}

/**
 * Descarta tabelas da memória, invalida o cache cifrado e remove a sessão
 * do Firestore ao fazer logout.
 * Chamado por core/auth.js → fazerLogout().
 */
function limparNormasMemoria() {
  _servidor = null;
  _cacheKey = null; // chave perdida → sessionStorage indecifrável
  sessionStorage.removeItem(_SS_KEY);
  _removerSessao(); // fire-and-forget
}

/**
 * Retorna as tabelas carregadas do servidor (usadas pelos getters em normas/index.js).
 * @returns {object|null}
 */
function getServidorNormas() {
  return _servidor;
}

/** true se as tabelas já foram buscadas (com ou sem dados do servidor). */
function normasCarregadas() {
  return _servidor !== null;
}

/**
 * Admin: popula o Firestore com as tabelas do bundle local.
 * Cria 4 documentos separados (_normas/{instrumento}) via batch.
 *
 * Executar UMA VEZ no console, logado como admin:
 *   await seedNormasFirestore()
 *
 * Após confirmar os dados no Firestore, remova os objetos de tabelas
 * dos arquivos normas/*.js (WISC_NORMAS, NEUPSILIN_NORMAS, NORMAS_INF,
 * BFP_NORMAS_FACETA) para que não sejam distribuídos no bundle público.
 *
 * @returns {Promise<boolean>}
 */
async function seedNormasFirestore() {
  const _u = (typeof window.__getUsuarioLogado === "function")
    ? window.__getUsuarioLogado()
    : window.usuarioLogado;
  if (!_u || _u.role !== "admin") {
    throw new Error("[normas] Apenas administradores podem executar a seed.");
  }

  // _getNormasBundleCompleto() é exposta por normas/index.js.
  // Usar window._getNormasBundleCompleto em vez de window[varName] porque
  // `const` em <script> NÃO é acessível via window["NOME_DA_CONST"].
  if (typeof window._getNormasBundleCompleto !== "function") {
    throw new Error("[normas] _getNormasBundleCompleto não encontrado — certifique-se que js/normas/index.js está carregado.");
  }
  const bundle = window._getNormasBundleCompleto();

  const mapa = [
    ["wisc",          "wisc"],
    ["neupsilin",     "neupsilin"],
    ["neupsilin-inf", "neupsilin-inf"],
    ["bfp",           "bfp"]
  ];

  for (const [id] of mapa) {
    if (!bundle[id] || typeof bundle[id] !== "object") {
      throw new Error(`[normas] tabela "${id}" está vazia — certifique-se que as tabelas ainda estão nos normas/*.js antes do seed.`);
    }
  }

  const meta = {
    _seedAt:  new Date().toISOString(),
    _seedPor: window.usuarioLogado.email,
    _versao:  "2.0"
  };

  // Batch garante atomicidade: ou tudo gravado, ou nada
  const batch = _firestoreDB.batch();
  for (const [id] of mapa) {
    batch.set(
      _firestoreDB.collection("_normas").doc(id),
      { tabelas: bundle[id], ...meta }
    );
  }
  await batch.commit();

  // Atualiza memória imediatamente (evita re-fetch)
  _servidor = Object.fromEntries(mapa.map(([id]) => [id, bundle[id]]));

  console.info("═══════════════════════════════════════════════════════");
  console.info("[normas] ✓ Seed v2 concluído — 4 documentos escritos:");
  mapa.forEach(([id]) => console.info(`  _normas/${id}`));
  console.info("[normas] Próximo passo: remova os objetos de tabelas:");
  console.info("  WISC_NORMAS, NEUPSILIN_NORMAS, NORMAS_INF, BFP_NORMAS_FACETA");
  console.info("═══════════════════════════════════════════════════════");
  return true;
}

// Expõe ao console do navegador (admin pode chamar diretamente)
window.seedNormasFirestore = seedNormasFirestore;
