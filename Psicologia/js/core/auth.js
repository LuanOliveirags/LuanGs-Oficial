/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/auth.js
   Autenticação, sessão e perfil do profissional.

   Depende de (carregados antes):
     core/firebase.js   → _firestoreDB
     core/database.js   → DB, hashSenha
     core/storage.js    → _cacheAvaliacoes, carregarAvaliacoes
     modules/pacientes/ → DB_PAC
   Globals usados em runtime:
     usuarioLogado, atualizarStats, renderizarTabelaRecentes (script.js)
     limparFormulario (modules/neupsilin/avaliacao.js)
═══════════════════════════════════════════════════════ */

/** Alterna visibilidade da senha no campo de login. */
function toggleSenha(btn) {
  const input  = document.getElementById("login-senha");
  const eyeOn  = document.getElementById("eye-open");
  const eyeOff = document.getElementById("eye-off");
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  eyeOn.classList.toggle("hidden",  isPassword);
  eyeOff.classList.toggle("hidden", !isPassword);
}

/** Autentica o profissional via Firestore e inicia a sessão. */
async function fazerLogin() {
  const email    = document.getElementById("login-email").value.trim().toLowerCase();
  const senha    = document.getElementById("login-senha").value;
  const errDiv   = document.getElementById("login-error");
  const btnLogin = document.querySelector("#page-login .btn-primary");

  if (!email || !senha) {
    errDiv.textContent = "Preencha e-mail e senha.";
    errDiv.classList.remove("hidden");
    return;
  }

  // Pré-validação do CPF — antes de consultar o Firestore
  const _identField = document.getElementById("login-crp");
  const _identValue = _identField?.value.trim() ?? "";

  const _cpfPreCheck = validarFormatoCPF(_identValue);
  if (!_cpfPreCheck.ok) {
    errDiv.textContent = _cpfPreCheck.mensagem;
    errDiv.classList.remove("hidden");
    return;
  }

  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Entrando…"; }

  // Garante que a auth anônima já está pronta antes de qualquer query ao Firestore
  try {
    if (!firebase.auth().currentUser) {
      await firebase.auth().signInAnonymously();
    }
  } catch (_) { /* silencioso — Firestore pode ter regras abertas */ }

  try {
    const doc = await _firestoreDB.collection("usuarios").doc(email).get();
    if (!doc.exists) {
      errDiv.textContent = "E-mail ou senha incorretos.";
      errDiv.classList.remove("hidden");
      return;
    }

    const usuarioData = doc.data();
    const hash = await hashSenha(senha);
    if (hash !== usuarioData.senhaHash) {
      errDiv.textContent = "E-mail ou senha incorretos.";
      errDiv.classList.remove("hidden");
      return;
    }

    if (usuarioData.role !== "admin" && !usuarioData.bloqueado && usuarioData.expiracao) {
      if (new Date(usuarioData.expiracao) < new Date()) {
        _firestoreDB.collection("usuarios").doc(email)
          .update({ bloqueado: true, bloqueadoEm: new Date().toISOString() })
          .catch(console.error);
        errDiv.textContent = "Seu acesso expirou. Entre em contato com o administrador.";
        errDiv.classList.remove("hidden");
        return;
      }
    }

    if (usuarioData.bloqueado && usuarioData.role !== "admin") {
      errDiv.textContent = "Seu acesso está bloqueado ou expirado. Entre em contato com o administrador.";
      errDiv.classList.remove("hidden");
      return;
    }

    // Validação do CPF: formato + conferência obrigatória com cadastro
    const cpfFinal = validarFormatoCPF(_identValue);
    if (!cpfFinal.ok) {
      errDiv.textContent = cpfFinal.mensagem;
      errDiv.classList.remove("hidden");
      return;
    }
    if (!usuarioData.cpf) {
      // Usuário sem CPF cadastrado — bloqueia login até admin corrigir
      errDiv.textContent = "CPF não registrado no cadastro. Solicite ao administrador que atualize seus dados.";
      errDiv.classList.remove("hidden");
      return;
    }
    if (normalizarCPF(_identValue) !== normalizarCPF(usuarioData.cpf)) {
      errDiv.textContent = "E-mail, senha ou CPF incorretos.";
      errDiv.classList.remove("hidden");
      return;
    }
    // Para psicólogos: dispara verificação assíncrona no cadastro do CFP (não bloqueia o login)
    if (usuarioData.role !== "admin") {
      validarCRPExternoAsync(usuarioData.crp || "", email, _identValue);
    }

    await DB.carregarTodos(usuarioData.role === "admin", email);
    await DB_PAC.carregarCache(email, usuarioData.role === "admin");
    await carregarAvaliacoes(email, usuarioData.role === "admin");
    await carregarNormas(email, usuarioData.role);  // registra sessão + busca tabelas
    if (estadoNormas().state === "error") {
      console.warn("[login] Normas não carregadas:", estadoNormas().error);
    }
    DB.verificarExpiracoes();

    errDiv.classList.add("hidden");
    usuarioLogado = {
      email: usuarioData.email,
      nome:  usuarioData.nome,
      crp:   usuarioData.crp,
      cpf:   normalizarCPF(_identValue),
      role:  usuarioData.role
    };
    sessionStorage.setItem("neupsilin_user", JSON.stringify(usuarioLogado));
    limparFormulario();
    abrirDashboard();
    exibirAvisoObrigatorio();
  } catch (e) {
    console.error("[login] erro:", e);
    errDiv.textContent = "Erro: " + (e?.message || e?.code || JSON.stringify(e) || "desconhecido");
    errDiv.classList.remove("hidden");
  } finally {
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Entrar"; }
  }
}

/**
 * Detecta o papel do usuário pelo e-mail e alterna o campo identificador
 * entre CRP (psicólogo) e CPF (admin). Chamado no onblur do campo e-mail.
 */
async function detectarCampoIdentificador() {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  if (!email) return;

  const crpGroup  = document.getElementById("login-crp-group");
  const crpInput  = document.getElementById("login-crp");
  const crpHint   = document.getElementById("crp-hint");
  const crpStatus = document.getElementById("crp-status");
  if (!crpInput) return;

  try {
    const doc = await _firestoreDB.collection("usuarios").doc(email).get();
    if (!doc.exists) return;

    crpInput.value          = "";
    crpStatus.textContent   = "";
    crpHint.className       = "crp-hint";

    const cfpLink = document.getElementById("crp-cfp-link");
    if (doc.data().role === "admin") {
      crpInput.dataset.mode = "cpf";
      crpGroup.querySelector("label").innerHTML =
        'CPF <span class="crp-label-badge crp-label-badge--admin">Admin</span>';
      crpInput.placeholder = "000.000.000-00";
      crpInput.maxLength   = 14;
      crpHint.textContent  = "Formato: 000.000.000-00  \u00b7  CPF do administrador";
      if (cfpLink) cfpLink.classList.add("hidden");
    } else {
      crpInput.dataset.mode = "cpf";
      crpGroup.querySelector("label").innerHTML =
        'CPF <span class="crp-label-badge">Psic\u00f3logo</span>';
      crpInput.placeholder = "000.000.000-00";
      crpInput.maxLength   = 14;
      crpHint.textContent  = "Formato: 000.000.000-00  \u00b7  Confirma seu registro no CFP";
      if (cfpLink) cfpLink.classList.add("hidden"); // exibido só após validar formato
    }
  } catch { /* silencioso — não bloqueia login */ }
}

/** Encerra a sessão e limpa os caches em memória. */
function fazerLogout() {
  sessionStorage.removeItem("neupsilin_user");
  usuarioLogado    = null;
  DB._cache        = [];
  DB_PAC._cache    = [];
  _cacheAvaliacoes = [];
  limparNormasMemoria(); // descarta tabelas normativas da memória
  document.getElementById("page-login").classList.remove("hidden");
  document.getElementById("page-login").classList.add("active");
  document.getElementById("page-dashboard").classList.add("hidden");
  document.getElementById("login-email").value = "";
  document.getElementById("login-senha").value = "";
  // Resetar campo identificador para modo CPF (padrão)
  const _identReset = document.getElementById("login-crp");
  if (_identReset) {
    _identReset.value = "";
    _identReset.dataset.mode  = "cpf";
    _identReset.placeholder   = "000.000.000-00";
    _identReset.maxLength     = 14;
    const _lbl = document.querySelector("#login-crp-group label");
    if (_lbl) _lbl.innerHTML = 'CPF <span class="crp-label-badge">Psic\u00f3logo</span>';
    const _hint = document.getElementById("crp-hint");
    if (_hint) { _hint.textContent = "Formato: 000.000.000-00 \u00b7 Confirma seu registro no CFP"; _hint.className = "crp-hint"; }
    const _st = document.getElementById("crp-status");
    if (_st) _st.textContent = "";
    const _cfpLink = document.getElementById("crp-cfp-link");
    if (_cfpLink) _cfpLink.classList.add("hidden");
  }
}

// ── Aviso Obrigatório CFP ────────────────────────────────────

/** Exibe o aviso obrigatório CFP após login (uma vez por sessão de aba). */
function exibirAvisoObrigatorio() {
  if (sessionStorage.getItem("psi_aviso_aceito")) return;
  const el = document.getElementById("modal-aviso-overlay");
  if (el) el.classList.remove("hidden");
}

/** Habilita o botão de aceitar conforme o checkbox. */
function atualizarBotaoAviso() {
  const cb  = document.getElementById("aviso-checkbox");
  const btn = document.getElementById("aviso-btn-aceitar");
  if (btn) btn.disabled = !cb?.checked;
}

/** Registra a aceitação do aviso e fecha o modal. */
function aceitarAviso() {
  if (!document.getElementById("aviso-checkbox")?.checked) return;
  sessionStorage.setItem("psi_aviso_aceito", "1");
  const el = document.getElementById("modal-aviso-overlay");
  if (el) el.classList.add("hidden");
}

/** Transita da tela de login para o dashboard após autenticação. */
function abrirDashboard() {
  document.getElementById("page-login").classList.add("hidden");
  document.getElementById("page-dashboard").classList.remove("hidden");
  document.getElementById("sidebar-user-nome").textContent = usuarioLogado.nome;
  document.getElementById("sidebar-user-crp").textContent =
    usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` :
    usuarioLogado.role === "admin" ? "Administrador" : "";
  document.getElementById("topbar-user-name").textContent  = usuarioLogado.nome;

  // ── Exibir/ocultar abas ANTES de qualquer renderização ──
  document.querySelectorAll(".nav-admin").forEach(el => {
    el.style.display = usuarioLogado.role === "admin" ? "flex" : "none";
  });
  const _uApl = DB.findByEmail(usuarioLogado.email);
  document.querySelectorAll(".nav-aplicacao").forEach(el => {
    el.style.display = (_uApl?.ocultarAplicacao && usuarioLogado.role !== "admin") ? "none" : "flex";
  });
  const btnSenha = document.getElementById("btn-alterar-senha");
  if (btnSenha) btnSenha.style.display = usuarioLogado.role !== "admin" ? "block" : "none";

  document.querySelectorAll(".sec").forEach(s => {
    s.style.display = "none";
    s.classList.remove("active");
  });
  const dashSec = document.getElementById("sec-dashboard");
  dashSec.style.display = "block";
  dashSec.classList.add("active");

  try { atualizarStats(); } catch(e) { console.warn("[dashboard] atualizarStats:", e); }
  try { renderizarTabelaRecentes(); } catch(e) { console.warn("[dashboard] renderizarTabelaRecentes:", e); }
}

// ── Modal de Perfil ────────────────────────────────────

/** Abre o modal de edição de perfil do profissional logado. */
function abrirModalPerfil() {
  if (!usuarioLogado) return;
  const u = DB.findByEmail(usuarioLogado.email);
  document.getElementById("perfil-nome").value  = u ? u.nome  : "";
  document.getElementById("perfil-crp").value   = u ? u.crp   : "";
  document.getElementById("perfil-email").value = usuarioLogado.email;
  ["perfil-senha-atual", "perfil-senha-nova", "perfil-senha-confirmar"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("perfil-error").classList.add("hidden");
  document.getElementById("perfil-success").classList.add("hidden");
  document.getElementById("modal-perfil-overlay").classList.remove("hidden");
}

function fecharModalPerfil() {
  document.getElementById("modal-perfil-overlay").classList.add("hidden");
}

/** Salva alterações de nome, CRP e/ou senha do usuário logado. */
async function salvarPerfil() {
  const errEl = document.getElementById("perfil-error");
  const okEl  = document.getElementById("perfil-success");
  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  const nome       = document.getElementById("perfil-nome").value.trim();
  const crp        = document.getElementById("perfil-crp").value.trim();
  const senhaAtual = document.getElementById("perfil-senha-atual").value;
  const senhaNova  = document.getElementById("perfil-senha-nova").value;
  const senhaCfm   = document.getElementById("perfil-senha-confirmar").value;

  if (!nome) {
    errEl.textContent = "O nome não pode ficar em branco.";
    errEl.classList.remove("hidden");
    return;
  }

  const querTrocarSenha = senhaAtual || senhaNova || senhaCfm;
  if (querTrocarSenha) {
    if (!senhaAtual) {
      errEl.textContent = "Informe a senha atual para poder trocá-la.";
      errEl.classList.remove("hidden");
      return;
    }
    if (!senhaNova || !senhaCfm) {
      errEl.textContent = "Preencha a nova senha e a confirmação.";
      errEl.classList.remove("hidden");
      return;
    }
    if (senhaNova.length < 6) {
      errEl.textContent = "A nova senha deve ter pelo menos 6 caracteres.";
      errEl.classList.remove("hidden");
      return;
    }
    if (senhaNova !== senhaCfm) {
      errEl.textContent = "As senhas não coincidem.";
      errEl.classList.remove("hidden");
      return;
    }
    const hashAtual = await hashSenha(senhaAtual);
    const usuario   = DB.findByEmail(usuarioLogado.email);
    if (!usuario || usuario.senhaHash !== hashAtual) {
      errEl.textContent = "Senha atual incorreta.";
      errEl.classList.remove("hidden");
      return;
    }
  }

  try {
    const atualizado = await DB.updatePerfil(usuarioLogado.email, {
      nome,
      crp,
      novaSenha: querTrocarSenha ? senhaNova : undefined
    });
    usuarioLogado.nome = atualizado.nome;
    usuarioLogado.crp  = atualizado.crp;
    sessionStorage.setItem("neupsilin_user", JSON.stringify(usuarioLogado));
    document.getElementById("sidebar-user-nome").textContent = usuarioLogado.nome;
    document.getElementById("sidebar-user-crp").textContent =
      usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` :
      usuarioLogado.role === "admin" ? "Administrador" : "";
    document.getElementById("topbar-user-name").textContent  = usuarioLogado.nome;
    okEl.textContent = "Perfil atualizado com sucesso!";
    okEl.classList.remove("hidden");
    setTimeout(() => fecharModalPerfil(), 1800);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}
