/* ═══════════════════════════════════════════════════════
   NEUPSILIN — Sistema Clínico  |  script.js
   Lógica: autenticação, avaliação, Firestore, PDF
═══════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────────────
let usuarioLogado = null;
let avaliacaoAtiva = null; // guarda última avaliação calculada para PDF
let modalAvaliacaoId = null;
const _charts = {};
let _cacheAvaliacoes = []; // cache em memória, populado após o login

// ──────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Auth anônima garante que as regras do Firestore sejam cumpridas
  await firebase.auth().signInAnonymously().catch(console.error);

  // Inicializa banco (cria admin padrão se Firestore ainda estiver vazio)
  await inicializarDB();

  // Tenta restaurar sessão
  const sessao = sessionStorage.getItem("neupsilin_user");
  if (sessao) {
    try {
      usuarioLogado = JSON.parse(sessao);
      await DB.carregarTodos(usuarioLogado.role === "admin", usuarioLogado.email);
      await DB_PAC.carregarCache(usuarioLogado.email, usuarioLogado.role === "admin");
      await carregarAvaliacoes(usuarioLogado.email, usuarioLogado.role === "admin");
      DB.verificarExpiracoes();
      abrirDashboard();
    } catch (_) {
      sessionStorage.removeItem("neupsilin_user");
      usuarioLogado = null;
    }
  }

  // Listener Enter no login
  document.getElementById("login-senha").addEventListener("keydown", e => {
    if (e.key === "Enter") fazerLogin();
  });

  // Abas dos subtestes
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => {
        c.classList.remove("active");
        c.classList.add("hidden");
      });
      btn.classList.add("active");
      const cont = document.getElementById("tab-" + tabId);
      cont.classList.remove("hidden");
      cont.classList.add("active");
    });
  });

  // Subtotais em tempo real
  document.querySelectorAll(".score-input").forEach(inp => {
    inp.addEventListener("input", atualizarSubtotal);
  });

  // Abas WISC
  document.querySelectorAll(".wisc-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.wiscTab;
      document.querySelectorAll(".wisc-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".wisc-tab-content").forEach(c => {
        c.classList.remove("active");
        c.classList.add("hidden");
      });
      btn.classList.add("active");
      const cont = document.getElementById("wisc-tab-" + tabId);
      if (cont) { cont.classList.remove("hidden"); cont.classList.add("active"); }
    });
  });

  // Subtotais e EI estimado em tempo real para WISC
  document.querySelectorAll(".wisc-score").forEach(inp => {
    inp.addEventListener("input", atualizarSubtotalWISC);
  });
});

// ──────────────────────────────────────────────────────
// AUTENTICAÇÃO
// ──────────────────────────────────────────────────────
async function fazerLogin() {
  const email  = document.getElementById("login-email").value.trim().toLowerCase();
  const senha  = document.getElementById("login-senha").value;
  const errDiv = document.getElementById("login-error");
  const btnLogin = document.querySelector("#page-login .btn-primary");

  if (!email || !senha) {
    errDiv.textContent = "Preencha e-mail e senha.";
    errDiv.classList.remove("hidden");
    return;
  }

  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Entrando…"; }

  try {
    // Busca direto no Firestore (cache ainda não está carregado)
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

    // Verifica expiração diretamente
    if (usuarioData.role !== "admin" && !usuarioData.bloqueado && usuarioData.expiracao) {
      if (new Date(usuarioData.expiracao) < new Date()) {
        const ts = new Date().toISOString();
        _firestoreDB.collection("usuarios").doc(email)
          .update({ bloqueado: true, bloqueadoEm: ts }).catch(console.error);
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

    // Carrega caches após autenticação bem-sucedida
    await DB.carregarTodos(usuarioData.role === "admin", email);
    await DB_PAC.carregarCache(email, usuarioData.role === "admin");
    await carregarAvaliacoes(email, usuarioData.role === "admin");
    DB.verificarExpiracoes();

    errDiv.classList.add("hidden");
    usuarioLogado = { email: usuarioData.email, nome: usuarioData.nome, crp: usuarioData.crp, role: usuarioData.role };
    sessionStorage.setItem("neupsilin_user", JSON.stringify(usuarioLogado));
    limparFormulario();
    abrirDashboard();
  } catch (e) {
    console.error(e);
    errDiv.textContent = "Erro ao conectar. Verifique sua conexão e tente novamente.";
    errDiv.classList.remove("hidden");
  } finally {
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Entrar"; }
  }
}

function fazerLogout() {
  sessionStorage.removeItem("neupsilin_user");
  usuarioLogado = null;
  // Limpa caches para não vazar dados entre sessões
  DB._cache = [];
  DB_PAC._cache = [];
  _cacheAvaliacoes = [];
  document.getElementById("page-login").classList.remove("hidden");
  document.getElementById("page-login").classList.add("active");
  document.getElementById("page-dashboard").classList.add("hidden");
  document.getElementById("login-email").value = "";
  document.getElementById("login-senha").value = "";
}

function abrirDashboard() {
  document.getElementById("page-login").classList.add("hidden");
  document.getElementById("page-dashboard").classList.remove("hidden");
  document.getElementById("sidebar-user-nome").textContent = usuarioLogado.nome;
  document.getElementById("sidebar-user-crp").textContent  = usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` : "";
  document.getElementById("topbar-user-name").textContent = usuarioLogado.nome;
  // Garante seção inicial visível
  document.querySelectorAll(".sec").forEach(s => { s.style.display = "none"; s.classList.remove("active"); });
  const dashSec = document.getElementById("sec-dashboard");
  dashSec.style.display = "block";
  dashSec.classList.add("active");
  atualizarStats();
  renderizarTabelaRecentes();
  // Exibir nav de usuários somente para admin
  document.querySelectorAll(".nav-admin").forEach(el => {
    el.style.display = usuarioLogado.role === "admin" ? "flex" : "none";
  });
  // Controla visibilidade da aba Aplicação de Testes por usuário
  const _uApl = DB.findByEmail(usuarioLogado.email);
  document.querySelectorAll(".nav-aplicacao").forEach(el => {
    el.style.display = (_uApl?.ocultarAplicacao && usuarioLogado.role !== "admin") ? "none" : "flex";
  });
  // Exibir botão Meu Perfil apenas para não-admin
  const btnSenha = document.getElementById("btn-alterar-senha");
  if (btnSenha) btnSenha.style.display = usuarioLogado.role !== "admin" ? "block" : "none";
}

// ──────────────────────────────────────────────────────
// ALTERAR SENHA
// ──────────────────────────────────────────────────────
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

async function salvarPerfil() {
  const errEl = document.getElementById("perfil-error");
  const okEl  = document.getElementById("perfil-success");
  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  const nome      = document.getElementById("perfil-nome").value.trim();
  const crp       = document.getElementById("perfil-crp").value.trim();
  const senhaAtual = document.getElementById("perfil-senha-atual").value;
  const senhaNova  = document.getElementById("perfil-senha-nova").value;
  const senhaCfm   = document.getElementById("perfil-senha-confirmar").value;

  if (!nome) {
    errEl.textContent = "O nome não pode ficar em branco.";
    errEl.classList.remove("hidden");
    return;
  }

  // Validação de senha somente se o usuário preencheu algum campo de senha
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
    // Atualiza sessão com novo nome
    usuarioLogado.nome = atualizado.nome;
    usuarioLogado.crp  = atualizado.crp;
    sessionStorage.setItem("neupsilin_user", JSON.stringify(usuarioLogado));
    document.getElementById("sidebar-user-nome").textContent = usuarioLogado.nome;
    document.getElementById("sidebar-user-crp").textContent  = usuarioLogado.crp ? `CRP ${usuarioLogado.crp}` : "";
    document.getElementById("topbar-user-name").textContent = usuarioLogado.nome;

    okEl.textContent = "Perfil atualizado com sucesso!";
    okEl.classList.remove("hidden");
    setTimeout(() => fecharModalPerfil(), 1800);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}

// ──────────────────────────────────────────────────────
// NAVEGAÇÃO SPA
// ──────────────────────────────────────────────────────
function navegarPara(secao, linkEl) {
  document.querySelectorAll(".sec").forEach(s => {
    s.classList.remove("active");
    s.style.display = "none";
  });
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const el = document.getElementById("sec-" + secao);
  if (el) {
    el.classList.remove("hidden");
    el.style.display = "block";
    el.classList.add("active");
  }
  if (linkEl) linkEl.classList.add("active");
  // Fecha sidebar no mobile
  document.getElementById("sidebar").classList.remove("open");

  const titulos = {
    dashboard: "Dashboard",
    testes: "Correção de Testes",
    "nova-avaliacao": "NEUPSILIN Adulto — Correção",
    "neupsilin-inf":  "NEUPSILIN-INF — Correção Infantil",
    wisc: "WISC-IV — Correção",
    aplicacao: "Aplicação de Testes",
    bfp: "BFP — Bateria Fatorial de Personalidade",
    historico: "Histórico de Avaliações",
    pacientes: "Pacientes",
    usuarios:  "Gerenciar Usuários"
  };
  document.getElementById("topbar-title").textContent = titulos[secao] || secao;

  if (secao === "historico")      renderizarHistorico();
  if (secao === "pacientes")      renderizarPacientes();
  if (secao === "usuarios")       renderizarUsuarios();
  if (secao === "nova-avaliacao") limparFormulario();
  if (secao === "neupsilin-inf")  limparFormularioInf();
  if (secao === "wisc")           limparWISC();
  if (secao === "bfp")            { limparBFP(); inicializarBFPForm(); }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function calcularIdade(nasc) {
  const hoje = new Date();
  const nascData = new Date(nasc);
  let idade = hoje.getFullYear() - nascData.getFullYear();
  const m = hoje.getMonth() - nascData.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascData.getDate())) idade--;
  return idade;
}

// ──────────────────────────────────────────────────────
// AVALIAÇÕES — Firestore + cache em memória
// ──────────────────────────────────────────────────────
async function carregarAvaliacoes(email, isAdmin) {
  const col  = _firestoreDB.collection("avaliacoes");
  const snap = isAdmin
    ? await col.get()
    : await col.where("profissional.email", "==", email.toLowerCase().trim()).get();
  _cacheAvaliacoes = snap.docs.map(d => d.data());
}

function salvarAvaliacao(av) {
  // Garante que a avaliação sempre carrega o email do profissional que a criou
  av.profissional.email = usuarioLogado.email;

  // ── Vincula / cria paciente automaticamente ──────────────────────────────
  const nomePac = av.paciente?.nome?.trim();
  const nascPac = av.paciente?.nasc;
  if (nomePac && nascPac) {
    // Procura paciente existente do mesmo profissional com mesmo nome + nasc
    const existing = DB_PAC.getMeus().find(p =>
      p.nome.toLowerCase() === nomePac.toLowerCase() && p.nasc === nascPac
    );
    if (existing) {
      av.pacienteId = existing.id;
    } else {
      const sexoPac = av.paciente.sexo || "";
      const escMap  = { baixa: "fi", media: "mc", alta: "sc" };
      const escCod  = escMap[av.paciente.esc] || av.paciente.esc || "";
      const novo = DB_PAC.create({
        nome:  nomePac,
        nasc:  nascPac,
        sexo:  (sexoPac === "M" || sexoPac === "F") ? sexoPac : "",
        esc:   escCod,
        cpf: "", tel: "", email: "", resp: "", telResp: "", enc: "", queixa: "", obs: ""
      });
      av.pacienteId = novo.id;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Garante ID numérico (compatibilidade com código existente)
  if (!av.id) av.id = Date.now();

  // Persiste no cache e dispara escrita no Firestore
  _cacheAvaliacoes.push(av);
  _firestoreDB.collection("avaliacoes").doc(String(av.id)).set(av).catch(console.error);

  // Plano "1 Avaliação": bloqueia automaticamente após salvar
  const usr = DB.findByEmail(usuarioLogado.email);
  if (usr && usr.plano === "1avaliacao" && usr.role !== "admin") {
    DB.bloquear(usuarioLogado.email);
  }
}

/** Retorna TODAS as avaliações (uso interno e para o admin). */
function _todasAvaliacoes() {
  return _cacheAvaliacoes;
}

/**
 * Retorna as avaliações visíveis para o usuário logado:
 * - Admin vê tudo.
 * - Profissional vê apenas as suas próprias.
 */
function getAvaliacoes() {
  const todas = _todasAvaliacoes();
  if (usuarioLogado?.role === "admin") return todas;
  return todas.filter(a => a.profissional?.email === usuarioLogado?.email);
}

function excluirAvaliacao(id) {
  // Só remove se o usuário tem acesso à avaliação
  const idNum = Number(id);
  const permitidos = getAvaliacoes().map(a => Number(a.id));
  if (!permitidos.includes(idNum)) return;
  _cacheAvaliacoes = _cacheAvaliacoes.filter(a => Number(a.id) !== idNum);
  _firestoreDB.collection("avaliacoes").doc(String(id)).delete().catch(console.error);
}

// ──────────────────────────────────────────────────────
// RENDER: Resultado inline (ver neupsilin/avaliacao.js)
// ──────────────────────────────────────────────────────

function buildResultadoHTML(av, ctx) {
  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const escMap = { baixa: "Baixa (0–4 anos)", media: "Média (5–11 anos)", alta: "Alta (12+ anos)" };

  let areasHTML = "";
  for (const area of areas) {
    const r = av.resultados[area];
    const pct = Math.round((r.score / r.max) * 100);
    areasHTML += `
      <div class="resultado-area">
        <div class="area-nome">${AREA_NOMES[area]}</div>
        <div class="area-score">${r.score}<span class="area-max">/${r.max}</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin:2px 0">z = ${r.z.toFixed(2)} &nbsp;|&nbsp; ${pct}%</div>
        <div class="area-class"><span class="badge ${r.classe.badge}">${r.classe.label}</span></div>
      </div>`;
  }

  const interp = gerarInterpretacao(av);

  return `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">
      <strong>${av.paciente.nome}</strong> &nbsp;|&nbsp;
      ${av.paciente.idade} anos &nbsp;|&nbsp;
      Escolaridade: ${escMap[av.paciente.esc]} &nbsp;|&nbsp;
      Avaliação em: ${formatarData(av.data)}
    </div>
    <div class="resultado-total">
      <div>
        <div class="total-label">Escore Total Bruto</div>
        <div class="total-score">${av.totalBruto} <span style="font-size:18px;opacity:.7">/ ${av.maxTotal}</span></div>
      </div>
      <div class="total-class">${av.classeGeral.label}</div>
    </div>
    <div class="resultado-grid">${areasHTML}</div>
    <div class="graficos-container">
      <canvas id="chart-radar-${ctx}"></canvas>
      <canvas id="chart-barras-${ctx}"></canvas>
    </div>
    <div class="resultado-interp"><strong>Interpretação:</strong><br>${interp}</div>`;
}

// ──────────────────────────────────────────────────────
// GRÁFICOS (Chart.js)
// ──────────────────────────────────────────────────────
function renderizarGraficos(av, ctx) {
  const areas  = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const labels = ["Orienta\u00e7\u00e3o","Aten\u00e7\u00e3o","Percep\u00e7\u00e3o","Mem\u00f3ria","Hab. Aritm.","Linguagem","Fun\u00e7. Exec.","Praxias"];

  const corPorZ = z => {
    if (z >= 1.0)  return { bg: "rgba(22,163,74,0.7)",   brd: "rgb(22,163,74)" };
    if (z >= 0.5)  return { bg: "rgba(5,150,105,0.7)",   brd: "rgb(5,150,105)" };
    if (z >= -0.5) return { bg: "rgba(37,99,235,0.7)",   brd: "rgb(37,99,235)" };
    if (z >= -1.0) return { bg: "rgba(217,119,6,0.7)",   brd: "rgb(217,119,6)" };
    return           { bg: "rgba(220,38,38,0.7)",    brd: "rgb(220,38,38)" };
  };

  const cores = areas.map(a => corPorZ(av.resultados[a].z));

  // Destrói gráficos anteriores com esse ctx
  if (_charts[`radar_${ctx}`])  _charts[`radar_${ctx}`].destroy();
  if (_charts[`barras_${ctx}`]) _charts[`barras_${ctx}`].destroy();

  // ── Radar ──
  const canvasRadar = document.getElementById(`chart-radar-${ctx}`);
  if (canvasRadar) {
    _charts[`radar_${ctx}`] = new Chart(canvasRadar, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Paciente (z)",
            data: areas.map(a => +av.resultados[a].z.toFixed(2)),
            backgroundColor: "rgba(37,99,235,0.12)",
            borderColor: "rgba(37,99,235,0.9)",
            borderWidth: 2.5,
            pointBackgroundColor: cores.map(c => c.brd),
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: "Média normativa",
            data: areas.map(() => 0),
            borderColor: "rgba(148,163,184,0.6)",
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: -3.5, max: 3.5,
            ticks: { stepSize: 1, font: { size: 10 }, backdropColor: "transparent" },
            pointLabels: { font: { size: 11, weight: "600" } },
            grid: { color: "rgba(0,0,0,0.07)" },
            angleLines: { color: "rgba(0,0,0,0.07)" }
          }
        },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16 } },
          tooltip: {
            callbacks: {
              label: ctx => ` z = ${ctx.raw}`
            }
          }
        }
      }
    });
  }

  // ── Barras ──
  const canvasBar = document.getElementById(`chart-barras-${ctx}`);
  if (canvasBar) {
    _charts[`barras_${ctx}`] = new Chart(canvasBar, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Paciente (%)",
            data: areas.map(a => Math.round((av.resultados[a].score / av.resultados[a].max) * 100)),
            backgroundColor: cores.map(c => c.bg),
            borderColor:     cores.map(c => c.brd),
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: "Média do grupo (%)",
            data: areas.map(a => Math.round((av.resultados[a].media / av.resultados[a].max) * 100)),
            backgroundColor: "rgba(148,163,184,0.2)",
            borderColor: "rgba(148,163,184,0.7)",
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { callback: v => v + "%", font: { size: 11 } },
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16 } },
          tooltip: {
            callbacks: {
              label: c => ` ${c.dataset.label}: ${c.raw}%`
            }
          }
        }
      }
    });
  }
}

function gerarInterpretacao(av) {
  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const fracos = areas.filter(a => av.resultados[a].z < -1.0).map(a => AREA_NOMES[a]);
  const fortes = areas.filter(a => av.resultados[a].z >= 1.0).map(a => AREA_NOMES[a]);

  let txt = `O desempenho geral de <strong>${av.paciente.nome}</strong> foi classificado como <strong>${av.classeGeral.label}</strong>, ${av.classeGeral.interp}. `;

  if (fortes.length)
    txt += `Destacaram-se positivamente: <em>${fortes.join(", ")}</em>. `;

  if (fracos.length)
    txt += `Foram observados escores inferiores ao esperado em: <em>${fracos.join(", ")}</em>, sugerindo necessidade de avaliação complementar nessas funções. `;
  else
    txt += `Não foram identificadas áreas com desempenho significativamente abaixo da média para o grupo normativo de referência. `;

  txt += `Os escores brutos foram comparados às normas do NEUPSILIN estratificadas por faixa etária (${getFaixaEtaria(av.paciente.idade)} anos) e escolaridade.`;
  return txt;
}

// ──────────────────────────────────────────────────────
// RENDER: Tabelas e stats
// ──────────────────────────────────────────────────────
function atualizarStats() {
  const lista = getAvaliacoes();
  const agora = new Date();
  const mes = lista.filter(a => {
    const d = new Date(a.data);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const pacientes = DB_PAC.getMeus();
  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.textContent = lista.length;
  document.getElementById("stat-pacientes").textContent = pacientes.length;
  document.getElementById("stat-mes").textContent       = mes.length;
}

function renderizarTabelaRecentes() {
  const lista = getAvaliacoes().slice(-5).reverse();
  const tbody = document.getElementById("tbody-recentes");
  const isAdmin = usuarioLogado?.role === "admin";
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhuma avaliação registrada.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(a => {
    const isBFP  = a.tipoTeste === "BFP";
    const teste  = a.tipoTeste || "NEUPSILIN";
    const bgColor = isBFP ? "rgb(99,102,241)"
      : teste === "WISC-IV" ? "var(--accent)"
      : teste === "NEUPSILIN-INF" ? "var(--success)" : "var(--primary)";
    const testeLabel = isBFP ? "BFP" : teste === "NEUPSILIN-ADULTO" ? "NEUPSILIN" : teste;
    const classeGeral = isBFP
      ? (() => { const ts = a.fatorScores?.N?.tscore ?? 50; return { badge: ts >= 60 ? "badge-inferior" : ts >= 45 ? "badge-medio" : "badge-superior", label: `N: T${ts}` }; })()
      : a.tipoTeste === "WISC-IV" ? (a.indices?.fsiq?.classe || { badge: "badge-medio", label: "\u2014" })
      : (a.classeGeral || { badge: "badge-medio", label: "\u2014" });
    return `
    <tr>
      <td>${formatarData(a.data)}</td>
      <td>${a.paciente.nome} <span class="badge" style="font-size:10px;padding:2px 6px;margin-left:4px;background:${bgColor};color:#fff">${testeLabel}</span>${isAdmin ? ` <span style="font-size:11px;color:var(--text-muted)">/ ${a.profissional?.nome || a.profissional?.email || ""}</span>` : ""}</td>
      <td><span class="badge ${classeGeral.badge}">${classeGeral.label}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="abrirModal(${a.id})">Ver</button>
      </td>
    </tr>`;}).join("");
}

function renderizarHistorico(filtro = "") {
  const lista = getAvaliacoes().reverse();
  const tbody = document.getElementById("tbody-historico");
  const isAdmin = usuarioLogado?.role === "admin";

  // Ajusta cabeçalho dinamicamente
  const thead = document.querySelector("#tabela-historico thead tr");
  if (thead) {
    thead.innerHTML = `
      <th>Data</th>
      ${isAdmin ? "<th>Profissional</th>" : ""}
      <th>Teste</th>
      <th>Paciente</th>
      <th>Idade</th>
      <th>Escore / QI</th>
      <th>Classificação</th>
      <th>Ações</th>`;
  }

  const vis = filtro
    ? lista.filter(a => a.paciente.nome.toLowerCase().includes(filtro.toLowerCase()))
    : lista;

  const cols = isAdmin ? 8 : 7;
  if (!vis.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-row">Nenhuma avaliação encontrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = vis.map(a => {
    const isWISC = a.tipoTeste === "WISC-IV";
    const isINF  = a.tipoTeste === "NEUPSILIN-INF";
    const isBFP  = a.tipoTeste === "BFP";
    const testeBadge = isBFP
      ? `<span class="badge" style="background:rgb(99,102,241);color:#fff">BFP</span>`
      : isWISC
        ? `<span class="badge" style="background:var(--accent);color:#fff">WISC-IV</span>`
        : isINF
          ? `<span class="badge" style="background:var(--success);color:#fff">NEUPSILIN-INF</span>`
          : `<span class="badge" style="background:var(--primary);color:#fff">NEUPSILIN</span>`;
    const classeGeral = isBFP
      ? (() => { const ts = a.fatorScores?.N?.tscore ?? 50; return { badge: ts >= 60 ? "badge-inferior" : ts >= 45 ? "badge-medio" : "badge-superior", label: `N: T${ts}` }; })()
      : isWISC
        ? (a.indices?.fsiq?.classe || { badge: "badge-medio", label: "—" })
        : (a.classeGeral || { badge: "badge-medio", label: "—" });
    const scoreCol = isBFP
      ? `T-N: ${a.fatorScores?.N?.tscore ?? "—"}`
      : isWISC
        ? `QI: ${a.indices?.fsiq?.score ?? "—"}`
        : `${a.totalBruto}/${a.maxTotal}`;
    return `
    <tr>
      <td>${formatarData(a.data)}</td>
      ${isAdmin ? `<td><span style="font-size:12px;color:var(--text-muted)">${a.profissional?.nome || a.profissional?.email || "—"}</span></td>` : ""}
      <td>${testeBadge}</td>
      <td>${a.paciente.nome}</td>
      <td>${a.paciente.idade} anos</td>
      <td>${scoreCol}</td>
      <td><span class="badge ${classeGeral.badge}">${classeGeral.label}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-primary" onclick="abrirModal(${a.id})">Ver</button>
        <button class="btn btn-sm btn-danger" onclick="confirmarExcluir(${a.id})">🗑</button>
      </td>
    </tr>`;}).join("");
}

function filtrarHistorico() {
  const q = document.getElementById("busca-historico").value;
  renderizarHistorico(q);
}

// ──────────────────────────────────────────────────────
// MODAL
// ──────────────────────────────────────────────────────
function abrirModal(id) {
  // id pode vir como string (onclick) ou número — normaliza para comparação
  const idNum = Number(id);
  const av = getAvaliacoes().find(a => Number(a.id) === idNum);
  if (!av) return;
  modalAvaliacaoId = id;
  if (av.tipoTeste === "WISC-IV") {
    document.getElementById("modal-body").innerHTML = buildResultadoWISCHTML(av, "modal");
    document.getElementById("modal-pdf-btn").onclick = () => exportarPDFWISC(av);
    document.getElementById("modal-overlay").classList.remove("hidden");
    requestAnimationFrame(() => renderizarGraficosWISC(av, "modal"));
  } else if (av.tipoTeste === "NEUPSILIN-INF") {
    document.getElementById("modal-body").innerHTML = buildResultadoHTMLInf(av, "modal");
    document.getElementById("modal-pdf-btn").onclick = () => exportarPDFInf(av);
    document.getElementById("modal-overlay").classList.remove("hidden");
    requestAnimationFrame(() => renderizarGraficosInf(av, "modal"));
  } else if (av.tipoTeste === "BFP") {
    document.getElementById("modal-body").innerHTML = buildResultadoBFPHTML(av, "modal");
    document.getElementById("modal-pdf-btn").onclick = () => exportarPDFBFP(av);
    document.getElementById("modal-overlay").classList.remove("hidden");
    requestAnimationFrame(() => renderizarGraficosBFP(av, "modal"));
  } else {
    document.getElementById("modal-body").innerHTML = buildResultadoHTML(av, "modal");
    document.getElementById("modal-pdf-btn").onclick = () => exportarPDF(av);
    document.getElementById("modal-overlay").classList.remove("hidden");
    requestAnimationFrame(() => renderizarGraficos(av, "modal"));
  }
  document.getElementById("modal-del-btn").onclick = () => confirmarExcluir(id);
}

function fecharModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  modalAvaliacaoId = null;
}

function confirmarExcluir(id) {
  if (!confirm("Deseja excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
  excluirAvaliacao(id);
  fecharModal();
  atualizarStats();
  renderizarTabelaRecentes();
  renderizarHistorico(document.getElementById("busca-historico")?.value || "");
}

// ──────────────────────────────────────────────────────
// LIMPAR FORMULÁRIO
// ──────────────────────────────────────────────────────
function limparFormulario() {
  document.getElementById("pac-nome").value = "";
  document.getElementById("pac-nasc").value = "";
  document.getElementById("pac-esc").value  = "";
  document.getElementById("obs-clinicas").value = "";
  document.querySelectorAll(".score-input").forEach(inp => inp.value = "");
  ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"].forEach(a => {
    const el = document.getElementById("sub-" + a);
    if (el) el.textContent = "0";
  });
  document.getElementById("resultado-inline").classList.add("hidden");
  avaliacaoAtiva = null;
}

// ──────────────────────────────────────────────────────
// EXPORTAR PDF (LAUDO)
// ──────────────────────────────────────────────────────
function exportarPDF(avParam) {
  const av = avParam || avaliacaoAtiva;
  if (!av) { alert("Nenhuma avaliação para exportar."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const L  = 20;  // margem esquerda
  const R  = 190; // limite direito
  const W  = R - L;
  let   Y  = 20;

  const cor   = [37, 99, 235]; // azul primário
  const cinza = [100, 116, 139];
  const preto = [30, 41, 59];

  // ── Cabeçalho ──
  doc.setFillColor(...cor);
  doc.rect(0, 0, 210, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("NEUPSILIN", L, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Instrumento de Avaliação Neuropsicológica Breve", L, 20);
  doc.text("LAUDO DE AVALIAÇÃO", L, 26);

  // Profissional (canto direito)
  doc.setFontSize(8);
  doc.text(`Profissional: ${av.profissional.nome}`, R, 16, { align: "right" });
  doc.text(`${av.profissional.crp}`, R, 21, { align: "right" });
  doc.text(`Data: ${formatarData(av.data)}`, R, 26, { align: "right" });

  Y = 42;

  // ── Dados do paciente ──
  doc.setFillColor(248, 250, 252);
  doc.rect(L, Y - 5, W, 24, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(L, Y - 5, W, 24);

  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO PACIENTE", L + 4, Y + 1);

  const escMap = { baixa: "Baixa (0–4 anos)", media: "Média (5–11 anos)", alta: "Alta (12+ anos)" };
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${av.paciente.nome}`, L + 4, Y + 7);
  doc.text(`Idade: ${av.paciente.idade} anos  |  Nascimento: ${formatarDataBR(av.paciente.nasc)}  |  Sexo: ${av.paciente.sexo === "M" ? "Masculino" : "Feminino"}`, L + 4, Y + 13);
  doc.text(`Escolaridade: ${escMap[av.paciente.esc]}  |  Faixa etária normativa: ${getFaixaEtaria(av.paciente.idade)} anos`, L + 4, Y + 19);
  Y += 30;

  // ── Resultado geral ──
  doc.setFillColor(...cor);
  doc.rect(L, Y, W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`CLASSIFICAÇÃO GERAL: ${av.classeGeral.label.toUpperCase()}`, L + 4, Y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Escore Total Bruto: ${av.totalBruto} / ${av.maxTotal}`, L + 4, Y + 11);
  Y += 20;

  // ── Tabela de resultados por área ──
  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RESULTADOS POR ÁREA", L, Y);
  Y += 7;

  // Cabeçalho da tabela
  const cols = [L, L+62, L+90, L+112, L+135, L+158];
  const rowH = 8;

  doc.setFillColor(226, 232, 240);
  doc.rect(L, Y, W, rowH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cinza);
  doc.text("ÁREA", cols[0] + 2, Y + 5);
  doc.text("ESCORE", cols[1] + 2, Y + 5);
  doc.text("% MÁX", cols[2] + 2, Y + 5);
  doc.text("z-SCORE", cols[3] + 2, Y + 5);
  doc.text("MÉDIA REF.", cols[4] + 2, Y + 5);
  doc.text("CLASSIFICAÇÃO", cols[5] + 2, Y + 5);
  Y += rowH;

  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  areas.forEach((area, i) => {
    const r = av.resultados[area];
    const pct = Math.round((r.score / r.max) * 100);
    const corLinha = badgeParaCor(r.classe.badge);

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(L, Y, W, rowH, "F");
    }
    doc.setTextColor(...preto);
    doc.text(AREA_NOMES[area], cols[0] + 2, Y + 5);
    doc.text(`${r.score} / ${r.max}`, cols[1] + 2, Y + 5);
    doc.text(`${pct}%`, cols[2] + 2, Y + 5);
    doc.text(r.z.toFixed(2), cols[3] + 2, Y + 5);
    doc.text(`${r.media.toFixed(1)} ±${r.dp.toFixed(1)}`, cols[4] + 2, Y + 5);

    // Badge colorida
    doc.setFillColor(...corLinha.bg);
    doc.roundedRect(cols[5] + 2, Y + 1, 30, 5.5, 2, 2, "F");
    doc.setTextColor(...corLinha.txt);
    doc.setFont("helvetica", "bold");
    doc.text(r.classe.label, cols[5] + 17, Y + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...preto);

    // linha divisória
    doc.setDrawColor(226, 232, 240);
    doc.line(L, Y + rowH, R, Y + rowH);
    Y += rowH;
  });

  Y += 10;

  // ── Interpretação ──
  if (Y > 230) { doc.addPage(); Y = 20; }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...preto);
  doc.text("INTERPRETAÇÃO", L, Y);
  Y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...cinza);
  const interpTxt = stripHTML(gerarInterpretacao(av));
  const linhas = doc.splitTextToSize(interpTxt, W);
  doc.text(linhas, L, Y);
  Y += linhas.length * 5 + 6;

  // ── Observações clínicas ──
  if (av.obs) {
    if (Y > 240) { doc.addPage(); Y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...preto);
    doc.text("OBSERVAÇÕES CLÍNICAS", L, Y);
    Y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...cinza);
    const obsLinhas = doc.splitTextToSize(av.obs, W);
    doc.text(obsLinhas, L, Y);
    Y += obsLinhas.length * 5 + 6;
  }

  // ── Rodapé assinatura ──
  if (Y > 250) { doc.addPage(); Y = 20; }
  Y = Math.max(Y, 250);

  doc.setDrawColor(...cinza);
  doc.line(L, Y, L + 80, Y);
  doc.setFontSize(8);
  doc.setTextColor(...cinza);
  doc.text(av.profissional.nome, L + 40, Y + 5, { align: "center" });
  doc.text(av.profissional.crp, L + 40, Y + 9, { align: "center" });
  doc.text(`Emitido em ${formatarData(new Date().toISOString())}`, R, Y + 9, { align: "right" });

  doc.setFontSize(7);
  doc.text("Documento gerado pelo Sistema NEUPSILIN. Uso exclusivo do profissional avaliador.", 105, 292, { align: "center" });

  const nomeArq = `laudo_neupsilin_${av.paciente.nome.replace(/\s+/g,"_").toLowerCase()}_${formatarDataArq(av.data)}.pdf`;
  doc.save(nomeArq);
}

// Converte cor de badge para RGB para o PDF
function badgeParaCor(badge) {
  const map = {
    "badge-superior":  { bg: [220,252,231], txt: [21,128,61] },
    "badge-medio-sup": { bg: [209,250,229], txt: [6,95,70] },
    "badge-medio":     { bg: [219,234,254], txt: [29,78,216] },
    "badge-medio-inf": { bg: [254,249,195], txt: [161,98,7] },
    "badge-inferior":  { bg: [254,226,226], txt: [185,28,28] }
  };
  return map[badge] || { bg: [226,232,240], txt: [100,116,139] };
}

// ──────────────────────────────────────────────────────
// UTILITÁRIOS
// ──────────────────────────────────────────────────────
function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function formatarDataBR(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}
function formatarDataArq(iso) {
  return new Date(iso).toISOString().slice(0,10);
}
function stripHTML(str) {
  return str.replace(/<[^>]+>/g, "");
}

// ──────────────────────────────────────────────────────
// GERENCIAMENTO DE USUÁRIOS (admin only)
// ──────────────────────────────────────────────────────
let _editandoEmail = null; // null = criando novo | string = editando
let _ativandoEmail = null; // email do usuário sendo ativado

function abrirModalUsuario(emailEditar = null) {
  _editandoEmail = emailEditar;

  const errEl  = document.getElementById("usr-error");
  const okEl   = document.getElementById("usr-success");
  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  const titulo    = document.getElementById("modal-usr-titulo");
  const btnSalvar = document.getElementById("usr-salvar-btn");
  const senhaHint  = document.getElementById("usr-senha-hint");
  const senhaLabel = document.getElementById("usr-senha-label");
  const planoGroup = document.getElementById("usr-plano-group");

  if (emailEditar) {
    const u = DB.findByEmail(emailEditar);
    titulo.textContent          = "Editar Usuário";
    btnSalvar.textContent       = "Salvar Alterações";
    document.getElementById("usr-nome").value  = u.nome;
    document.getElementById("usr-email").value = u.email;
    document.getElementById("usr-email").disabled = true;
    document.getElementById("usr-senha").value = "";
    document.getElementById("usr-crp").value   = u.crp || "";
    document.getElementById("usr-role").value  = u.role || "profissional";
    const ocultarChkEdit = document.getElementById("usr-ocultar-aplicacao");
    if (ocultarChkEdit) ocultarChkEdit.checked = !!(u.ocultarAplicacao);
    senhaLabel.textContent = "Nova Senha";
    senhaHint.classList.remove("hidden");
    if (planoGroup) planoGroup.style.display = "none";
  } else {
    titulo.textContent          = "Novo Usuário";
    btnSalvar.textContent       = "Criar Usuário";
    document.getElementById("usr-nome").value  = "";
    document.getElementById("usr-email").value = "";
    document.getElementById("usr-email").disabled = false;
    document.getElementById("usr-senha").value = "";
    document.getElementById("usr-crp").value   = "";
    document.getElementById("usr-role").value  = "profissional";
    document.getElementById("usr-plano").value = "1mes";
    const ocultarChkNovo = document.getElementById("usr-ocultar-aplicacao");
    if (ocultarChkNovo) ocultarChkNovo.checked = false;
    senhaLabel.textContent = "Senha *";
    senhaHint.classList.add("hidden");
    if (planoGroup) planoGroup.style.display = "";
  }

  document.getElementById("modal-usuario-overlay").classList.remove("hidden");
}

function fecharModalUsuario() {
  document.getElementById("modal-usuario-overlay").classList.add("hidden");
  document.getElementById("usr-email").disabled = false;
  _editandoEmail = null;
}

async function salvarUsuario() {
  const nome  = document.getElementById("usr-nome").value.trim();
  const email = document.getElementById("usr-email").value.trim();
  const senha = document.getElementById("usr-senha").value;
  const crp   = document.getElementById("usr-crp").value.trim();
  const role  = document.getElementById("usr-role").value;
  const plano = document.getElementById("usr-plano")?.value || "1mes";
  const ocultarAplicacao = document.getElementById("usr-ocultar-aplicacao")?.checked || false;

  const errEl = document.getElementById("usr-error");
  const okEl  = document.getElementById("usr-success");
  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  try {
    if (_editandoEmail) {
      await DB.updateAdmin(_editandoEmail, {
        nome: nome || undefined,
        crp,
        role,
        ocultarAplicacao,
        novaSenha: senha || undefined
      });
      okEl.textContent = "Usuário atualizado com sucesso!";
    } else {
      await DB.create({ email, senha, nome, crp, role, plano, ocultarAplicacao });
      okEl.textContent = `Usuário "${nome}" criado com sucesso!`;
    }
    okEl.classList.remove("hidden");
    setTimeout(() => fecharModalUsuario(), 1200);
    renderizarUsuarios();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}

function excluirUsuarioAdmin(email) {
  if (email === usuarioLogado.email) {
    alert("Você não pode excluir sua própria conta.");
    return;
  }
  if (!confirm(`Deseja excluir o usuário "${email}"? Esta ação não pode ser desfeita.`)) return;
  DB.delete(email);
  renderizarUsuarios();
}

function bloquearUsuario(email) {
  if (email === usuarioLogado.email) { alert("Você não pode bloquear sua própria conta."); return; }
  if (!confirm(`Bloquear o acesso de "${email}"?`)) return;
  DB.bloquear(email);
  renderizarUsuarios();
}

function abrirModalAtivacao(email) {
  _ativandoEmail = email;
  const u = DB.findByEmail(email);
  document.getElementById("modal-ativacao-desc").textContent =
    `Ativar acesso para ${u.nome} (${email})`;
  document.getElementById("ativacao-plano").value = "1mes";
  document.getElementById("modal-ativacao-overlay").classList.remove("hidden");
}

function fecharModalAtivacao() {
  document.getElementById("modal-ativacao-overlay").classList.add("hidden");
  _ativandoEmail = null;
}

function confirmarAtivacao() {
  if (!_ativandoEmail) return;
  const plano = document.getElementById("ativacao-plano").value;
  DB.ativar(_ativandoEmail, plano);
  fecharModalAtivacao();
  renderizarUsuarios();
}

function renderizarUsuarios() {
  DB.verificarExpiracoes();
  const busca  = (document.getElementById("usr-busca")?.value || "").toLowerCase().trim();
  const todos  = DB.getAll();
  const roMap  = { admin: "Administrador", profissional: "Profissional" };
  const bMap   = { admin: "badge-admin", profissional: "badge-prof" };
  const planoLabel = { "1mes": "1 Mês", "3meses": "3 Meses", "vitalicio": "Vitalício", "1avaliacao": "1 Avaliação" };

  const filtrados = busca
    ? todos.filter(u => u.nome.toLowerCase().includes(busca) || u.email.toLowerCase().includes(busca))
    : todos;

  const ativos     = filtrados.filter(u => !u.bloqueado);
  const bloqueados = filtrados.filter(u =>  u.bloqueado);

  // Contador
  const cA = document.getElementById("count-ativos");
  const cB = document.getElementById("count-bloqueados");
  if (cA) cA.textContent = ativos.length;
  if (cB) cB.textContent = bloqueados.length;

  // Tabela ativos
  const tbAtivos = document.getElementById("tbody-usuarios-ativos");
  if (tbAtivos) {
    if (!ativos.length) {
      tbAtivos.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum usuário ativo.</td></tr>';
    } else {
      tbAtivos.innerHTML = ativos.map(u => {
        const expiraStr = u.expiracao
          ? (() => {
              const d = new Date(u.expiracao);
              const diff = Math.ceil((d - new Date()) / 86400000);
              const cor = diff <= 7 ? "color:var(--danger);font-weight:600" : diff <= 30 ? "color:var(--warning)" : "";
              return `<span style="${cor}">${d.toLocaleDateString("pt-BR")} (${diff}d)</span>`;
            })()
          : '<span style="color:var(--success)">Vitalício</span>';
        return `
    <tr>
      <td><strong>${u.nome}</strong></td>
      <td>${u.email}</td>
      <td>${u.crp || "—"}</td>
      <td><span class="badge ${bMap[u.role] || ''}">${roMap[u.role] || u.role}</span></td>
      <td><span class="badge" style="background:var(--primary-light,#e8f0fe);color:var(--primary)">${planoLabel[u.plano] || u.plano || "—"}</span></td>
      <td>${expiraStr}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="abrirModalUsuario('${u.email}')">✏️ Editar</button>
        ${u.email !== usuarioLogado.email
          ? `<button class="btn btn-sm btn-danger" onclick="bloquearUsuario('${u.email}')">🚫 Bloquear</button>`
          : `<span style="font-size:11px;color:var(--text-muted);padding:5px 4px">Conta atual</span>`}
      </td>
    </tr>`;
      }).join("");
    }
  }

  // Tabela bloqueados
  const tbBloq = document.getElementById("tbody-usuarios-bloqueados");
  if (tbBloq) {
    if (!bloqueados.length) {
      tbBloq.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum usuário bloqueado.</td></tr>';
    } else {
      tbBloq.innerHTML = bloqueados.map(u => `
    <tr>
      <td><strong>${u.nome}</strong></td>
      <td>${u.email}</td>
      <td>${u.crp || "—"}</td>
      <td><span class="badge ${bMap[u.role] || ''}">${roMap[u.role] || u.role}</span></td>
      <td>${u.bloqueadoEm ? formatarData(u.bloqueadoEm) : "—"}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" onclick="abrirModalAtivacao('${u.email}')">✅ Ativar</button>
        <button class="btn btn-sm btn-secondary" onclick="abrirModalUsuario('${u.email}')">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirUsuarioAdmin('${u.email}')">🗑 Excluir</button>
      </td>
    </tr>`).join("");
    }
  }
}

// ══════════════════════════════════════════════════════
//  WISC-IV — funções movidas para wisc/avaliacao.js
// ══════════════════════════════════════════════════════

// ── Subtotais e EI em tempo real ──
function atualizarSubtotalWISC(e) {
  const indice = e.target.dataset.indice;
  if (!indice) return;
  let soma = 0;
  document.querySelectorAll(`.wisc-score[data-indice="${indice}"]`).forEach(inp => {
    soma += parseInt(inp.value) || 0;
  });
  const somaEl = document.getElementById("wisc-soma-" + indice);
  const eiEl   = document.getElementById("wisc-ei-"   + indice);
  if (somaEl) somaEl.textContent = soma;
  if (eiEl)   eiEl.textContent   = soma > 0 ? calcularIndiceWISC(soma, indice) : "—";
}

// ── Limpar formulário WISC ──
function limparWISC() {
  ["wisc-nome", "wisc-obs"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const nascEl = document.getElementById("wisc-nasc");
  if (nascEl) nascEl.value = "";
  document.querySelectorAll(".wisc-score").forEach(inp => inp.value = "");
  ["cv","rp","mt","vp"].forEach(idx => {
    const somaEl = document.getElementById("wisc-soma-" + idx);
    const eiEl   = document.getElementById("wisc-ei-"   + idx);
    if (somaEl) somaEl.textContent = "0";
    if (eiEl)   eiEl.textContent   = "—";
  });
  const res = document.getElementById("wisc-resultado-inline");
  if (res) res.classList.add("hidden");
  wiscAvaliacaoAtiva = null;
}

// ── Calcular & Salvar WISC ──
function calcularESalvarWISC() {
  const nome = document.getElementById("wisc-nome").value.trim();
  const nasc = document.getElementById("wisc-nasc").value;
  const sexo = document.getElementById("wisc-sexo").value;

  if (!nome || !nasc) {
    alert("Preencha o Nome e a Data de Nascimento do paciente.");
    return;
  }

  const idade = calcularIdade(nasc);
  if (idade < 6 || idade > 16) {
    alert("O WISC-IV é normatizado para crianças e adolescentes de 6 a 16 anos.");
    return;
  }

  // Coleta escores ponderados por índice
  const subtestes = {};
  const indices   = {};
  let somaTodos   = 0;

  for (const [idx, subs] of Object.entries(WISC_SUBTESTES_POR_INDICE)) {
    let soma = 0;
    subs.forEach(sub => {
      const inp = document.querySelector(`.wisc-score[data-indice="${idx}"][data-sub="${sub}"]`);
      const val = Math.min(Math.max(parseInt(inp?.value) || 0, 0), 19);
      subtestes[sub] = val;
      soma += val;
    });
    const score = calcularIndiceWISC(soma, idx);
    indices[idx] = { soma, score, classe: classificarQI(score) };
    somaTodos += soma;
  }

  // QI Total (FSIQ) — média ponderada dos 4 índices (simplificado)
  const somaEI = Object.values(indices).reduce((acc, v) => acc + v.score, 0);
  const fsiq   = Math.round(somaEI / 4);
  indices.fsiq = { score: fsiq, classe: classificarQI(fsiq) };

  const avaliacao = {
    id: Date.now(),
    tipoTeste: "WISC-IV",
    data: new Date().toISOString(),
    profissional: usuarioLogado,
    paciente: { nome, nasc, sexo, idade },
    subtestes,
    indices,
    obs: document.getElementById("wisc-obs").value.trim()
  };

  salvarAvaliacao(avaliacao);
  wiscAvaliacaoAtiva = avaliacao;

  renderizarResultadoWISCInline(avaliacao);
  atualizarStats();
}

// ── Resultado inline WISC ──
function renderizarResultadoWISCInline(av) {
  const div = document.getElementById("wisc-resultado-conteudo");
  div.innerHTML = buildResultadoWISCHTML(av, "wisc-inline");
  const card = document.getElementById("wisc-resultado-inline");
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => renderizarGraficosWISC(av, "wisc-inline"));
}

// ── HTML do resultado WISC ──
function buildResultadoWISCHTML(av, ctx) {
  const ordemIndices = ["cv", "rp", "mt", "vp"];
  let indicesHTML = "";

  for (const idx of ordemIndices) {
    const r = av.indices[idx];
    indicesHTML += `
      <div class="resultado-area">
        <div class="area-nome">${WISC_INDICES[idx]}</div>
        <div class="area-score">${r.score}<span class="area-max"> EI</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin:2px 0">Soma ponderada: ${r.soma}</div>
        <div class="area-class"><span class="badge ${r.classe.badge}">${r.classe.label}</span></div>
      </div>`;
  }

  const fsiq   = av.indices.fsiq;
  const interp = gerarInterpretacaoWISC(av);

  return `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">
      <strong>${av.paciente.nome}</strong> &nbsp;|&nbsp;
      ${av.paciente.idade} anos &nbsp;|&nbsp;
      Avaliação em: ${formatarData(av.data)}
    </div>
    <div class="resultado-total">
      <div>
        <div class="total-label">QI Total (FSIQ)</div>
        <div class="total-score">${fsiq.score}</div>
      </div>
      <div class="total-class">${fsiq.classe.label}</div>
    </div>
    <div class="resultado-grid">${indicesHTML}</div>
    <div class="graficos-container">
      <canvas id="chart-radar-${ctx}"></canvas>
      <canvas id="chart-barras-${ctx}"></canvas>
    </div>
    <div class="resultado-interp"><strong>Interpretação:</strong><br>${interp}</div>`;
}

// ── Gráficos WISC ──
function renderizarGraficosWISC(av, ctx) {
  const ordemIndices = ["cv", "rp", "mt", "vp"];
  const labels = ["Compr. Verbal", "Rac. Perceptual", "Mem. Trabalho", "Vel. Processamento"];

  const corPorEI = ei => {
    if (ei >= 120) return { bg: "rgba(22,163,74,0.7)",   brd: "rgb(22,163,74)" };
    if (ei >= 110) return { bg: "rgba(5,150,105,0.7)",   brd: "rgb(5,150,105)" };
    if (ei >= 90)  return { bg: "rgba(124,58,237,0.7)",  brd: "rgb(124,58,237)" };
    if (ei >= 80)  return { bg: "rgba(217,119,6,0.7)",   brd: "rgb(217,119,6)" };
    return           { bg: "rgba(220,38,38,0.7)",    brd: "rgb(220,38,38)" };
  };

  const cores = ordemIndices.map(i => corPorEI(av.indices[i].score));

  if (_charts[`radar_${ctx}`])  _charts[`radar_${ctx}`].destroy();
  if (_charts[`barras_${ctx}`]) _charts[`barras_${ctx}`].destroy();

  // Radar — escores de índice (40–160, média=100)
  const canvasRadar = document.getElementById(`chart-radar-${ctx}`);
  if (canvasRadar) {
    _charts[`radar_${ctx}`] = new Chart(canvasRadar, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Paciente (EI)",
            data: ordemIndices.map(i => av.indices[i].score),
            backgroundColor: "rgba(124,58,237,0.12)",
            borderColor: "rgba(124,58,237,0.9)",
            borderWidth: 2.5,
            pointBackgroundColor: cores.map(c => c.brd),
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: "Média normativa (100)",
            data: ordemIndices.map(() => 100),
            borderColor: "rgba(148,163,184,0.6)",
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 50, max: 150,
            ticks: { stepSize: 25, font: { size: 10 }, backdropColor: "transparent" },
            pointLabels: { font: { size: 11, weight: "600" } },
            grid: { color: "rgba(0,0,0,0.07)" },
            angleLines: { color: "rgba(0,0,0,0.07)" }
          }
        },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16 } },
          tooltip: { callbacks: { label: c => ` EI = ${c.raw}` } }
        }
      }
    });
  }

  // Barras — escores de índice
  const canvasBar = document.getElementById(`chart-barras-${ctx}`);
  if (canvasBar) {
    _charts[`barras_${ctx}`] = new Chart(canvasBar, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Paciente (EI)",
            data: ordemIndices.map(i => av.indices[i].score),
            backgroundColor: cores.map(c => c.bg),
            borderColor:     cores.map(c => c.brd),
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: "Média normativa (100)",
            data: ordemIndices.map(() => 100),
            backgroundColor: "rgba(148,163,184,0.2)",
            borderColor: "rgba(148,163,184,0.7)",
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            min: 50, max: 150,
            ticks: { font: { size: 11 } },
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}` } }
        }
      }
    });
  }
}

// ── Interpretação WISC ──
function gerarInterpretacaoWISC(av) {
  const ordemIndices = ["cv", "rp", "mt", "vp"];
  const fsiq = av.indices.fsiq.score;
  const classe = av.indices.fsiq.classe;

  let txt = `O desempenho intelectual de <strong>${av.paciente.nome}</strong> foi avaliado pelo WISC-IV. `;
  txt += `O QI Total (FSIQ) obtido foi de <strong>${fsiq}</strong>, classificado como <strong>${classe.label}</strong>, `;
  txt += `indicando ${classe.interp}. `;

  const acima  = ordemIndices.filter(i => av.indices[i].score >= 110).map(i => WISC_INDICES[i]);
  const abaixo = ordemIndices.filter(i => av.indices[i].score < 90).map(i => WISC_INDICES[i]);

  if (acima.length)  txt += `Índices com desempenho acima da média: <em>${acima.join(", ")}</em>. `;
  if (abaixo.length) txt += `Índices abaixo da média: <em>${abaixo.join(", ")}</em>, sugerindo necessidade de investigação adicional nessas habilidades. `;
  if (!abaixo.length && !acima.length) txt += `Todos os índices cognitivos encontram-se dentro da faixa média esperada para a faixa etária. `;

  txt += `Os escores de índice foram calculados com base nas normas do WISC-IV para crianças de ${av.paciente.idade} anos.`;
  return txt;
}

// ── Exportar PDF WISC ──
function exportarPDFWISC(avParam) {
  const av = avParam || wiscAvaliacaoAtiva;
  if (!av) { alert("Nenhuma avaliação WISC para exportar."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 20, R = 190, W = R - L;
  let Y = 20;
  const cor   = [124, 58, 237]; // roxo (accent)
  const cinza = [100, 116, 139];
  const preto = [30, 41, 59];

  // Cabeçalho
  doc.setFillColor(...cor);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("WISC-IV", L, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Escala de Inteligência Wechsler para Crianças — 4.ª Edição", L, 20);
  doc.text("LAUDO DE AVALIAÇÃO", L, 26);
  doc.setFontSize(8);
  doc.text(`Profissional: ${av.profissional.nome}`, R, 16, { align: "right" });
  doc.text(`${av.profissional.crp || ""}`, R, 21, { align: "right" });
  doc.text(`Data: ${formatarData(av.data)}`, R, 26, { align: "right" });

  Y = 42;

  // Dados do paciente
  doc.setFillColor(248, 250, 252);
  doc.rect(L, Y - 5, W, 20, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(L, Y - 5, W, 20);
  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO PACIENTE", L + 4, Y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${av.paciente.nome}`, L + 4, Y + 7);
  doc.text(`Idade: ${av.paciente.idade} anos  |  Nascimento: ${formatarDataBR(av.paciente.nasc)}  |  Sexo: ${av.paciente.sexo === "M" ? "Masculino" : "Feminino"}`, L + 4, Y + 13);
  Y += 26;

  // QI Total
  const fsiq = av.indices.fsiq;
  const corFSIQ = badgeParaCor(fsiq.classe.badge);
  doc.setFillColor(...cor);
  doc.rect(L, Y, W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`QI TOTAL (FSIQ): ${fsiq.score}  —  ${fsiq.classe.label.toUpperCase()}`, L + 4, Y + 9);
  Y += 20;

  // Tabela de índices
  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ESCORES DE ÍNDICE", L, Y);
  Y += 7;

  const cols = [L, L + 70, L + 105, L + 130, L + 155];
  const rowH = 8;
  doc.setFillColor(226, 232, 240);
  doc.rect(L, Y, W, rowH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cinza);
  doc.text("ÍNDICE", cols[0] + 2, Y + 5);
  doc.text("SOMA PONDERADA", cols[1] + 2, Y + 5);
  doc.text("ESCORE (EI)", cols[2] + 2, Y + 5);
  doc.text("PERCENTIL", cols[3] + 2, Y + 5);
  doc.text("CLASSIFICAÇÃO", cols[4] + 2, Y + 5);
  Y += rowH;

  const ordemIndices = ["cv", "rp", "mt", "vp"];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ordemIndices.forEach((idx, i) => {
    const r = av.indices[idx];
    const corBadge = badgeParaCor(r.classe.badge);
    const percentil = Math.round(((r.score - 100) / 15) * 34 + 50);
    const pctClamp  = Math.max(1, Math.min(99, percentil));
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(L, Y, W, rowH, "F"); }
    doc.setTextColor(...preto);
    doc.text(WISC_INDICES[idx], cols[0] + 2, Y + 5);
    doc.text(`${r.soma}`, cols[1] + 2, Y + 5);
    doc.text(`${r.score}`, cols[2] + 2, Y + 5);
    doc.text(`~${pctClamp}º`, cols[3] + 2, Y + 5);
    doc.setFillColor(...corBadge.bg);
    doc.roundedRect(cols[4] + 2, Y + 1, 34, 5.5, 2, 2, "F");
    doc.setTextColor(...corBadge.txt);
    doc.setFont("helvetica", "bold");
    doc.text(r.classe.label, cols[4] + 19, Y + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...preto);
    doc.setDrawColor(226, 232, 240);
    doc.line(L, Y + rowH, R, Y + rowH);
    Y += rowH;
  });

  Y += 10;

  // Interpretação
  if (Y > 230) { doc.addPage(); Y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...preto);
  doc.text("INTERPRETAÇÃO", L, Y);
  Y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...cinza);
  const interpTxt = stripHTML(gerarInterpretacaoWISC(av));
  const linhas = doc.splitTextToSize(interpTxt, W);
  doc.text(linhas, L, Y);
  Y += linhas.length * 5 + 6;

  // Observações
  if (av.obs) {
    if (Y > 240) { doc.addPage(); Y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...preto);
    doc.text("OBSERVAÇÕES CLÍNICAS", L, Y);
    Y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...cinza);
    const obsLinhas = doc.splitTextToSize(av.obs, W);
    doc.text(obsLinhas, L, Y);
    Y += obsLinhas.length * 5 + 6;
  }

  // Assinatura
  if (Y > 250) { doc.addPage(); Y = 20; }
  Y = Math.max(Y, 250);
  doc.setDrawColor(...cinza);
  doc.line(L, Y, L + 80, Y);
  doc.setFontSize(8);
  doc.setTextColor(...cinza);
  doc.text(av.profissional.nome, L + 40, Y + 5, { align: "center" });
  doc.text(av.profissional.crp || "", L + 40, Y + 9, { align: "center" });
  doc.text(`Emitido em ${formatarData(new Date().toISOString())}`, R, Y + 9, { align: "right" });
  doc.setFontSize(7);
  doc.text("Documento gerado pelo Sistema Psicorrection. Uso exclusivo do profissional avaliador.", 105, 292, { align: "center" });

  const nomeArq = `laudo_wisc_${av.paciente.nome.replace(/\s+/g,"_").toLowerCase()}_${formatarDataArq(av.data)}.pdf`;
  doc.save(nomeArq);
}