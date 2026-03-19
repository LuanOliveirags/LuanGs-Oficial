/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/crp-validator.js
   Validação automática de CRP (Conselho Regional de Psicologia).

   CAMADAS DE VALIDAÇÃO:
     1. Formato  → regex client-side, instantâneo (sem rede)
     2. BD       → CRP digitado deve bater com o cadastrado pelo admin
     3. API ext  → consulta ao CFP (configure CRP_API_URL); fire-and-forget,
                   nunca bloqueia o login — só registra em _audit

   ISENÇÃO:
     Usuários com role "admin" são isentos de toda verificação.
     Para profissionais: o admin DEVE cadastrar o CRP ao criar a conta.

   CONFIGURAÇÃO:
     CRP_API_URL — URL de um proxy / Cloud Function que consulte o CFP.
                   Deixe vazio ("") para usar apenas formato + BD próprio.
                   Contrato esperado: GET ?crp=XX/NNNNN → { ativo: bool }

   USO:
     // Chamado em auth.js após verificar credenciais:
     const { ok, mensagem } = await validarCRPLogin(crpDigitado, usuarioData, email);
     if (!ok) { mostraErro(mensagem); return; }
═══════════════════════════════════════════════════════ */

// ── Configuração ──────────────────────────────────────
// URL do proxy/function que acessa a API do CFP.
// Quando o endpoint estiver disponível, defina de QUALQUER uma das formas:
//   1. Edite a constante abaixo (deploy permanente):
//        const _CRP_API_URL_PADRAO = "https://us-central1-psicorrection.cloudfunctions.net/validarCRP";
//   2. Configure em runtime sem alterar este arquivo (ex.: Firestore RemoteConfig):
//        window.PSI_CONFIG = { CRP_API_URL: "https://..." }   // antes dos scripts
//   3. Teste pontual no console do admin:
//        window.PSI_CONFIG = { CRP_API_URL: "https://..." }
const _CRP_API_URL_PADRAO = "";          // ← altere aqui quando tiver o endpoint
const CRP_API_TIMEOUT_MS  = 5000;

/** Retorna a URL da API, preferindo override em window.PSI_CONFIG */
function _getCRPApiUrl() {
  return window.PSI_CONFIG?.CRP_API_URL || _CRP_API_URL_PADRAO;
}

// Formato válido: "XX/NNNNN" (1-2 dígitos de região / 3-6 dígitos número)
const _CRP_REGEX = /^\d{1,2}\/\d{3,6}$/;

// ── Normalização ──────────────────────────────────────

/**
 * Remove variações de digitação e normaliza para "XX/NNNNN".
 * Aceita: "CRP 06/123456", "crp06/1234", "06/123.456" etc.
 * @param {string} raw
 * @returns {string}
 */
function normalizarCRP(raw = "") {
  return raw.trim()
    .replace(/^CRP\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/[.\-_]/g, "")
    .toUpperCase();
}

// ── Camada 1: Formato ─────────────────────────────────

/**
 * Valida apenas o formato do CRP (não consulta nenhuma fonte externa).
 * @param {string} crp — raw ou normalizado
 * @returns {{ ok: boolean, mensagem: string }}
 */
function validarFormatoCRP(crp) {
  const norm = normalizarCRP(crp);
  if (!norm) {
    return { ok: false, mensagem: "Informe seu CRP para continuar." };
  }
  if (!_CRP_REGEX.test(norm)) {
    return { ok: false, mensagem: "Formato inválido. Use: 06/123456  (região / número do CRP)." };
  }
  return { ok: true, mensagem: "" };
}

// ── Camada 2: Banco de dados próprio ─────────────────

/**
 * Valida o CRP digitado contra o CRP cadastrado pelo admin no Firestore.
 * @param {string} crpDigitado
 * @param {object} usuarioData — documento Firestore do usuário
 * @returns {{ ok: boolean, mensagem: string }}
 */
function validarCRPBancoDados(crpDigitado, usuarioData) {
  if (!usuarioData.crp) {
    return {
      ok: false,
      mensagem: "CRP não cadastrado para esta conta. Contate o administrador."
    };
  }
  if (normalizarCRP(crpDigitado) !== normalizarCRP(usuarioData.crp)) {
    return { ok: false, mensagem: "CRP não corresponde ao cadastrado nesta conta." };
  }
  return { ok: true, mensagem: "" };
}

// ── Camada 3: API externa CFP (fire-and-forget) ───────

/**
 * Consulta a API externa do CFP. Não bloqueia o login — apenas
 * registra o resultado em _audit para fins de auditoria e telemetria.
 * @param {string} crp   — normalizado
 * @param {string} email
 */
async function validarCRPExternoAsync(crp, email) {
  const apiUrl = _getCRPApiUrl();
  if (!apiUrl) return;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), CRP_API_TIMEOUT_MS);
  try {
    const resp = await fetch(`${apiUrl}?crp=${encodeURIComponent(crp)}`, {
      signal:  controller.signal,
      headers: { Accept: "application/json" }
    });
    const json = await resp.json();
    const status = json.ativo ? "✓ ativo" : "⚠ inativo / não encontrado";
    console.info(`[crp] API externa — CRP ${crp}: ${status}`);
    if (typeof _firestoreDB !== "undefined") {
      _firestoreDB.collection("_audit").add({
        tipo: "crp_api_externa", email, crp, resultado: json,
        ts: new Date().toISOString()
      }).catch(() => {});
    }
  } catch (e) {
    if (e.name !== "AbortError") console.warn("[crp] API externa indisponível:", e.message);
  } finally {
    clearTimeout(tid);
  }
}

// ── CPF (admin) ─────────────────────────────────────

/** Remove caracteres não numéricos do CPF. */
function normalizarCPF(raw = "") {
  return String(raw).replace(/\D/g, "");
}

/**
 * Valida formato e dígitos verificadores do CPF.
 * @param {string} cpf — raw (pode ter máscara) ou só dígitos
 * @returns {{ ok: boolean, mensagem: string }}
 */
function validarFormatoCPF(cpf) {
  const d = normalizarCPF(cpf);
  if (!d) return { ok: false, mensagem: "Informe o CPF para continuar." };
  if (d.length !== 11) return { ok: false, mensagem: "CPF inválido — deve conter 11 dígitos." };
  if (/^(\d)\1{10}$/.test(d)) return { ok: false, mensagem: "CPF inválido." };
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let v1 = (s * 10) % 11; if (v1 >= 10) v1 = 0;
  if (v1 !== +d[9]) return { ok: false, mensagem: "CPF inválido (dígito verificador)." };
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  let v2 = (s * 10) % 11; if (v2 >= 10) v2 = 0;
  if (v2 !== +d[10]) return { ok: false, mensagem: "CPF inválido (dígito verificador)." };
  return { ok: true, mensagem: "" };
}

// ── Validação completa no login ───────────────────────

/**
 * Executa todas as camadas de validação em sequência.
 * Admin (role === "admin") é isento — retorna ok imediatamente.
 *
 * @param {string} crpDigitado
 * @param {object} usuarioData — dados do Firestore
 * @param {string} email
 * @returns {Promise<{ ok: boolean, mensagem: string, crpNorm: string }>}
 */
async function validarCRPLogin(crpDigitado, usuarioData, email) {
  // Admin isento de toda verificação
  if (usuarioData.role === "admin") return { ok: true, mensagem: "", crpNorm: "" };

  // Camada 1: formato
  const fmt = validarFormatoCRP(crpDigitado);
  if (!fmt.ok) return { ...fmt, crpNorm: "" };

  const crpNorm = normalizarCRP(crpDigitado);

  // Camada 2: banco de dados
  const db = validarCRPBancoDados(crpDigitado, usuarioData);
  if (!db.ok) return { ...db, crpNorm };

  // Camada 3: API externa (não aguarda)
  validarCRPExternoAsync(crpNorm, email);

  return { ok: true, mensagem: "", crpNorm };
}

// ── Feedback visual em tempo real (DOM) ──────────────

/**
 * Atualiza o ícone de status e o hint do campo CRP enquanto o usuário digita.
 * Chamado via oninput no input#login-crp.
 * @param {HTMLInputElement} input
 */
function atualizarStatusCRP(input) {
  const status = document.getElementById("crp-status");
  const hint   = document.getElementById("crp-hint");
  if (!status || !hint) return;

  const isCpf = input.dataset.mode === "cpf";
  const val   = input.value.trim();

  if (!val) {
    status.textContent = "";
    hint.textContent   = isCpf
      ? "Formato: 000.000.000-00  ·  CPF do administrador"
      : "Formato: 06/123456  ·  Exigido pelo CFP";
    hint.className = "crp-hint";
    return;
  }

  if (isCpf) {
    const { ok, mensagem } = validarFormatoCPF(val);
    if (ok) {
      status.textContent = "✓";
      status.style.color = "var(--success)";
      hint.textContent   = "CPF válido";
      hint.className     = "crp-hint crp-hint--ok";
    } else {
      status.textContent = "✗";
      status.style.color = "var(--danger)";
      hint.textContent   = mensagem;
      hint.className     = "crp-hint crp-hint--err";
    }
    return;
  }

  const { ok, mensagem } = validarFormatoCRP(val);
  if (ok) {
    status.textContent = "✓";
    status.style.color = "var(--success)";
    hint.textContent   = `CRP ${normalizarCRP(val)} — formato válido`;
    hint.className     = "crp-hint crp-hint--ok";
  } else {
    status.textContent = "✗";
    status.style.color = "var(--danger)";
    hint.textContent   = mensagem;
    hint.className     = "crp-hint crp-hint--err";
  }
}
