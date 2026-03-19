/* ═══════════════════════════════════════════════════════
   PsiCorrection — script.js
   Estado global da aplicação, UI de dashboard, histórico,
   modal de resultados e gerenciamento de usuários (admin).

   Dependências já carregadas:
     core/firebase.js  · core/database.js  · core/utils.js
     core/storage.js   · core/auth.js      · core/navigation.js
     modules/…         · engine/calculator.js
═══════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────────────
let usuarioLogado    = null;  // preenchido por core/auth.js
let avaliacaoAtiva   = null;  // última avaliação calculada (NEUPSILIN adulto)
let modalAvaliacaoId = null;
const _charts        = {};   // instâncias Chart.js activas por ctx

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
      await carregarNormas(usuarioLogado.email, usuarioLogado.role);  // registra sessão + busca tabelas
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

  // Abas dos subtestes NEUPSILIN
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => {
        c.classList.remove("active"); c.classList.add("hidden");
      });
      btn.classList.add("active");
      const cont = document.getElementById("tab-" + tabId);
      cont.classList.remove("hidden"); cont.classList.add("active");
    });
  });

  // Subtotais em tempo real
  document.querySelectorAll(".score-input").forEach(inp =>
    inp.addEventListener("input", atualizarSubtotal));

  // Abas WISC
  document.querySelectorAll(".wisc-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.wiscTab;
      document.querySelectorAll(".wisc-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".wisc-tab-content").forEach(c => {
        c.classList.remove("active"); c.classList.add("hidden");
      });
      btn.classList.add("active");
      const cont = document.getElementById("wisc-tab-" + tabId);
      if (cont) { cont.classList.remove("hidden"); cont.classList.add("active"); }
    });
  });

  // Subtotais e EI estimado WISC em tempo real
  document.querySelectorAll(".wisc-score").forEach(inp =>
    inp.addEventListener("input", atualizarSubtotalWISC));
});

// ──────────────────────────────────────────────────────
// RENDER: Stats e tabelas
// ──────────────────────────────────────────────────────
function atualizarStats() {
  const lista = getAvaliacoes();
  const agora = new Date();
  const mes   = lista.filter(a => {
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
  const lista   = getAvaliacoes().slice(-5).reverse();
  const tbody   = document.getElementById("tbody-recentes");
  const isAdmin = usuarioLogado?.role === "admin";

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhuma avaliação registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(a => {
    const isBFP  = a.tipoTeste === "BFP";
    const teste  = a.tipoTeste || "NEUPSILIN";
    const bgColor = isBFP ? "rgb(99,102,241)"
      : teste === "WISC-IV"       ? "var(--accent)"
      : teste === "NEUPSILIN-INF" ? "var(--success)" : "var(--primary)";
    const testeLabel = isBFP ? "BFP"
      : teste === "NEUPSILIN-ADULTO" ? "NEUPSILIN" : teste;
    const classeGeral = isBFP
      ? (() => { const ts = a.fatorScores?.N?.tscore ?? 50; return { badge: ts >= 60 ? "badge-inferior" : ts >= 45 ? "badge-medio" : "badge-superior", label: `N: T${ts}` }; })()
      : a.tipoTeste === "WISC-IV"
        ? (a.indices?.fsiq?.classe || { badge: "badge-medio", label: "—" })
        : (a.classeGeral || { badge: "badge-medio", label: "—" });

    return `
    <tr>
      <td>${formatarData(a.data)}</td>
      <td>${a.paciente.nome}
        <span class="badge" style="font-size:10px;padding:2px 6px;margin-left:4px;background:${bgColor};color:#fff">${testeLabel}</span>
        ${isAdmin ? `<span style="font-size:11px;color:var(--text-muted)"> / ${a.profissional?.nome || a.profissional?.email || ""}</span>` : ""}
      </td>
      <td><span class="badge ${classeGeral.badge}">${classeGeral.label}</span></td>
      <td><button class="btn btn-sm btn-primary" onclick="abrirModal(${a.id})">Ver</button></td>
    </tr>`;
  }).join("");
}

function renderizarHistorico(filtro = "") {
  const lista   = getAvaliacoes().reverse();
  const tbody   = document.getElementById("tbody-historico");
  const isAdmin = usuarioLogado?.role === "admin";

  // Cabeçalho dinâmico
  const thead = document.querySelector("#tabela-historico thead tr");
  if (thead) {
    thead.innerHTML = `
      <th>Data</th>
      ${isAdmin ? "<th>Profissional</th>" : ""}
      <th>Teste</th><th>Paciente</th><th>Idade</th>
      <th>Escore / QI</th><th>Classificação</th><th>Ações</th>`;
  }

  const vis  = filtro ? lista.filter(a => a.paciente.nome.toLowerCase().includes(filtro.toLowerCase())) : lista;
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
    const scoreCol = isBFP ? `T-N: ${a.fatorScores?.N?.tscore ?? "—"}`
      : isWISC  ? `QI: ${a.indices?.fsiq?.score ?? "—"}`
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
        <button class="btn btn-sm btn-danger"  onclick="confirmarExcluir(${a.id})">🗑</button>
      </td>
    </tr>`;
  }).join("");
}

function filtrarHistorico() {
  renderizarHistorico(document.getElementById("busca-historico").value);
}

// ──────────────────────────────────────────────────────
// MODAL DE RESULTADO
// ──────────────────────────────────────────────────────
function abrirModal(id) {
  const idNum = Number(id);
  const av    = getAvaliacoes().find(a => Number(a.id) === idNum);
  if (!av) return;

  modalAvaliacaoId = id;
  document.getElementById("modal-body").innerHTML = engine.buildHTML(av, "modal");
  document.getElementById("modal-pdf-btn").onclick = () => engine.exportarPDF(av);
  document.getElementById("modal-del-btn").onclick = () => confirmarExcluir(id);
  document.getElementById("modal-overlay").classList.remove("hidden");
  requestAnimationFrame(() => engine.renderGraphs(av, "modal"));
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
// GERENCIAMENTO DE USUÁRIOS (admin only)
// ──────────────────────────────────────────────────────
let _editandoEmail = null; // null = criando | string = editando
let _ativandoEmail = null; // email sendo ativado

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
    document.getElementById("usr-nome").value   = u.nome;
    document.getElementById("usr-email").value  = u.email;
    document.getElementById("usr-email").disabled = true;
    document.getElementById("usr-senha").value  = "";
    document.getElementById("usr-crp").value    = u.crp || "";
    document.getElementById("usr-role").value   = u.role || "profissional";
    const ocultarChk = document.getElementById("usr-ocultar-aplicacao");
    if (ocultarChk) ocultarChk.checked = !!(u.ocultarAplicacao);
    senhaLabel.textContent = "Nova Senha";
    senhaHint.classList.remove("hidden");
    if (planoGroup) planoGroup.style.display = "none";
  } else {
    titulo.textContent          = "Novo Usuário";
    btnSalvar.textContent       = "Criar Usuário";
    document.getElementById("usr-nome").value   = "";
    document.getElementById("usr-email").value  = "";
    document.getElementById("usr-email").disabled = false;
    document.getElementById("usr-senha").value  = "";
    document.getElementById("usr-crp").value    = "";
    document.getElementById("usr-role").value   = "profissional";
    document.getElementById("usr-plano").value  = "1mes";
    const ocultarChk = document.getElementById("usr-ocultar-aplicacao");
    if (ocultarChk) ocultarChk.checked = false;
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
      await DB.updateAdmin(_editandoEmail, { nome: nome || undefined, crp, role, ocultarAplicacao, novaSenha: senha || undefined });
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
  if (email === usuarioLogado.email) { alert("Você não pode excluir sua própria conta."); return; }
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
  document.getElementById("modal-ativacao-desc").textContent = `Ativar acesso para ${u.nome} (${email})`;
  document.getElementById("ativacao-plano").value = "1mes";
  document.getElementById("modal-ativacao-overlay").classList.remove("hidden");
}

function fecharModalAtivacao() {
  document.getElementById("modal-ativacao-overlay").classList.add("hidden");
  _ativandoEmail = null;
}

function confirmarAtivacao() {
  if (!_ativandoEmail) return;
  DB.ativar(_ativandoEmail, document.getElementById("ativacao-plano").value);
  fecharModalAtivacao();
  renderizarUsuarios();
}

function renderizarUsuarios() {
  DB.verificarExpiracoes();
  const busca     = (document.getElementById("usr-busca")?.value || "").toLowerCase().trim();
  const todos     = DB.getAll();
  const roMap     = { admin: "Administrador", profissional: "Profissional" };
  const bMap      = { admin: "badge-admin", profissional: "badge-prof" };
  const planoLabel = { "1mes": "1 Mês", "3meses": "3 Meses", "vitalicio": "Vitalício", "1avaliacao": "1 Avaliação" };

  const filtrados  = busca ? todos.filter(u => u.nome.toLowerCase().includes(busca) || u.email.toLowerCase().includes(busca)) : todos;
  const ativos     = filtrados.filter(u => !u.bloqueado);
  const bloqueados = filtrados.filter(u =>  u.bloqueado);

  const cA = document.getElementById("count-ativos");
  const cB = document.getElementById("count-bloqueados");
  if (cA) cA.textContent = ativos.length;
  if (cB) cB.textContent = bloqueados.length;

  const tbAtivos = document.getElementById("tbody-usuarios-ativos");
  if (tbAtivos) {
    if (!ativos.length) {
      tbAtivos.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum usuário ativo.</td></tr>';
    } else {
      tbAtivos.innerHTML = ativos.map(u => {
        const expiraStr = u.expiracao
          ? (() => {
              const d    = new Date(u.expiracao);
              const diff = Math.ceil((d - new Date()) / 86400000);
              const cor  = diff <= 7 ? "color:var(--danger);font-weight:600" : diff <= 30 ? "color:var(--warning)" : "";
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
          ? `<button class="btn btn-sm btn-danger" onclick="bloquearUsuario('${u.email}')">🚫 Bloquear</button>
             <button class="btn btn-sm btn-danger" onclick="excluirUsuarioAdmin('${u.email}')">🗑 Excluir</button>`
          : `<span style="font-size:11px;color:var(--text-muted);padding:5px 4px">Conta atual</span>`}
      </td>
    </tr>`;
      }).join("");
    }
  }

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
        <button class="btn btn-sm btn-primary"   onclick="abrirModalAtivacao('${u.email}')">✅ Ativar</button>
        <button class="btn btn-sm btn-secondary" onclick="abrirModalUsuario('${u.email}')">✏️ Editar</button>
        <button class="btn btn-sm btn-danger"    onclick="excluirUsuarioAdmin('${u.email}')">🗑 Excluir</button>
      </td>
    </tr>`).join("");
    }
  }
}
