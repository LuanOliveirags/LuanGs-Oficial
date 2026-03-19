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

  // Pré-validação de formato CRP (client-side, antes de consultar o Firestore)
  const crpInput = document.getElementById("login-crp").value.trim();
  if (crpInput) {
    const fmtCheck = validarFormatoCRP(crpInput);
    if (!fmtCheck.ok) {
      errDiv.textContent = fmtCheck.mensagem;
      errDiv.classList.remove("hidden");
      return;
    }
  }

  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Entrando…"; }

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

    // Validação completa de CRP (psicólogos apenas — admin é automaticamente isento)
    const crpCheck = await validarCRPLogin(
      document.getElementById("login-crp").value,
      usuarioData, email);
    if (!crpCheck.ok) {
      errDiv.textContent = crpCheck.mensagem;
      errDiv.classList.remove("hidden");
      return;
    }

    await DB.carregarTodos(usuarioData.role === "admin", email);
    await DB_PAC.carregarCache(email, usuarioData.role === "admin");
    await carregarAvaliacoes(email, usuarioData.role === "admin");
    await carregarNormas(email, usuarioData.role);  // registra sessão + busca tabelas
    DB.verificarExpiracoes();

    errDiv.classList.add("hidden");
    usuarioLogado = {
      email: usuarioData.email,
      nome:  usuarioData.nome,
      crp:   usuarioData.crp,
      role:  usuarioData.role
    };
    sessionStorage.setItem("neupsilin_user", JSON.stringify(usuarioLogado));
    limparFormulario();
    abrirDashboard();
    exibirAvisoObrigatorio();
  } catch (e) {
    console.error(e);
    errDiv.textContent = "Erro ao conectar. Verifique sua conexão e tente novamente.";
    errDiv.classList.remove("hidden");
  } finally {
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Entrar"; }
  }
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
  document.getElementById("sidebar-user-crp").textContent  = usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` : "";
  document.getElementById("topbar-user-name").textContent  = usuarioLogado.nome;

  document.querySelectorAll(".sec").forEach(s => {
    s.style.display = "none";
    s.classList.remove("active");
  });
  const dashSec = document.getElementById("sec-dashboard");
  dashSec.style.display = "block";
  dashSec.classList.add("active");

  atualizarStats();
  renderizarTabelaRecentes();

  document.querySelectorAll(".nav-admin").forEach(el => {
    el.style.display = usuarioLogado.role === "admin" ? "flex" : "none";
  });
  const _uApl = DB.findByEmail(usuarioLogado.email);
  document.querySelectorAll(".nav-aplicacao").forEach(el => {
    el.style.display = (_uApl?.ocultarAplicacao && usuarioLogado.role !== "admin") ? "none" : "flex";
  });
  const btnSenha = document.getElementById("btn-alterar-senha");
  if (btnSenha) btnSenha.style.display = usuarioLogado.role !== "admin" ? "block" : "none";
}

// ── Modal de Perfil ────────────────────────────────────

/** Abre o modal de edição de perfil do profissional logado. */
function abrirModalPerfil() {
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
    document.getElementById("sidebar-user-crp").textContent  = usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` : "";
    document.getElementById("topbar-user-name").textContent  = usuarioLogado.nome;
    okEl.textContent = "Perfil atualizado com sucesso!";
    okEl.classList.remove("hidden");
    setTimeout(() => fecharModalPerfil(), 1800);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}
