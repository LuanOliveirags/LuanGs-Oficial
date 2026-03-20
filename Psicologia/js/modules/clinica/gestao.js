/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CLÃNICA â€” js/modules/clinica/gestao.js  (v2)
   GestÃ£o de Agenda, Financeiro e Perfil da ClÃ­nica.

   Novidades v2:
     Â· Barra de mÃ©tricas em tempo real (hoje/semana/receita/pendentes)
     Â· Strip "Hoje" com cards clicÃ¡veis no topo da agenda
     Â· "PrÃ³xima sessÃ£o" destacada em gradiente
     Â· Toggle rÃ¡pido de status com um clique no badge
     Â· DetecÃ§Ã£o de conflito de horÃ¡rios no modal
     Â· Auto-preenchimento de hora fim e valor padrÃ£o
     Â· Agendamento recorrente semanal (4 semanas)
     Â· Contador de sessÃ£o por paciente (#1, #2â€¦)
     Â· Filtro por perÃ­odo (hoje/semana/mÃªs/prÃ³ximos)
     Â· GrÃ¡fico de receita dos Ãºltimos 6 meses (Chart.js)
     Â· Barra de progresso de meta mensal
     Â· Ticket mÃ©dio e tendÃªncia % vs. mÃªs anterior
     Â· ExportaÃ§Ã£o CSV do financeiro
     Â· Mensagem de cobranÃ§a para WhatsApp (clipboard)
     Â· Toast de feedback nÃ£o intrusivo

   ColeÃ§Ãµes no Firestore:
     "clinicas"           â†’ perfil por email do profissional
     "agendamentos"       â†’ agenda de sessÃµes/consultas
     "financeiro_clinica" â†’ registros de pagamento

   Depende de (carregados antes):
     core/firebase.js               â†’ _firestoreDB
     modules/pacientes/db_pacientes.js â†’ DB_PAC
   Globals usados em runtime:
     usuarioLogado
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BANCO DE DADOS â€” DB_CLINICA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DB_CLINICA = {
  _perfilCache:  null,
  _agendamentos: [],
  _financeiro:   [],
  _loaded:       false,

  async carregar(email, isAdmin) {
    const emailNorm = email.toLowerCase().trim();
    try {
      const doc = await _firestoreDB.collection("clinicas").doc(emailNorm).get();
      this._perfilCache = doc.exists ? doc.data() : null;

      const colAgen = _firestoreDB.collection("agendamentos");
      const snapAgen = isAdmin
        ? await colAgen.orderBy("data", "desc").limit(500).get()
        : await colAgen.where("emailProfissional", "==", emailNorm).orderBy("data", "desc").get();
      this._agendamentos = snapAgen.docs.map(d => d.data());

      const colFin = _firestoreDB.collection("financeiro_clinica");
      const snapFin = isAdmin
        ? await colFin.orderBy("data", "desc").limit(500).get()
        : await colFin.where("emailProfissional", "==", emailNorm).orderBy("data", "desc").get();
      this._financeiro = snapFin.docs.map(d => d.data());
    } catch (err) {
      console.error("[DB_CLINICA] Erro ao carregar:", err);
    }
    this._loaded = true;
  },

  getPerfil() { return this._perfilCache; },

  async salvarPerfil(email, dados) {
    const emailNorm = email.toLowerCase().trim();
    const perfil = { ...dados, email: emailNorm, atualizadoEm: new Date().toISOString() };
    await _firestoreDB.collection("clinicas").doc(emailNorm).set(perfil, { merge: true });
    this._perfilCache = { ...(this._perfilCache || {}), ...perfil };
    return this._perfilCache;
  },

  getMeusAgendamentos() {
    if (usuarioLogado?.role === "admin") return this._agendamentos;
    return this._agendamentos.filter(a => a.emailProfissional === usuarioLogado?.email);
  },

  criarAgendamento(dados) {
    const id = "agen_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
    const agen = { id, ...dados, emailProfissional: usuarioLogado?.email || "", criadoEm: new Date().toISOString() };
    this._agendamentos.unshift(agen);
    _firestoreDB.collection("agendamentos").doc(id).set(agen).catch(console.error);
    return agen;
  },

  atualizarAgendamento(id, dados) {
    const idx = this._agendamentos.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const atualizado = { ...this._agendamentos[idx], ...dados, atualizadoEm: new Date().toISOString() };
    this._agendamentos[idx] = atualizado;
    _firestoreDB.collection("agendamentos").doc(id)
      .update({ ...dados, atualizadoEm: atualizado.atualizadoEm }).catch(console.error);
    return atualizado;
  },

  deletarAgendamento(id) {
    const permitidos = this.getMeusAgendamentos().map(a => a.id);
    if (!permitidos.includes(id)) return;
    this._agendamentos = this._agendamentos.filter(a => a.id !== id);
    _firestoreDB.collection("agendamentos").doc(id).delete().catch(console.error);
  },

  getMeuFinanceiro() {
    if (usuarioLogado?.role === "admin") return this._financeiro;
    return this._financeiro.filter(f => f.emailProfissional === usuarioLogado?.email);
  },

  criarFinanceiro(dados) {
    const id = "fin_" + Date.now();
    const reg = { id, ...dados, emailProfissional: usuarioLogado?.email || "", criadoEm: new Date().toISOString() };
    this._financeiro.unshift(reg);
    _firestoreDB.collection("financeiro_clinica").doc(id).set(reg).catch(console.error);
    return reg;
  },

  atualizarFinanceiro(id, dados) {
    const idx = this._financeiro.findIndex(f => f.id === id);
    if (idx === -1) return null;
    const atualizado = { ...this._financeiro[idx], ...dados, atualizadoEm: new Date().toISOString() };
    this._financeiro[idx] = atualizado;
    _firestoreDB.collection("financeiro_clinica").doc(id)
      .update({ ...dados, atualizadoEm: atualizado.atualizadoEm }).catch(console.error);
    return atualizado;
  },

  deletarFinanceiro(id) {
    const permitidos = this.getMeuFinanceiro().map(f => f.id);
    if (!permitidos.includes(id)) return;
    this._financeiro = this._financeiro.filter(f => f.id !== id);
    _firestoreDB.collection("financeiro_clinica").doc(id).delete().catch(console.error);
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ESTADO LOCAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _editandoAgenId = null;
let _editandoFinId  = null;
let _abaClinAtiva   = "agenda";
let _chartReceita   = null;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CONSTANTES DE UI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AGEN_STATUS_INFO = {
  agendado:  { cor: "#3b82f6", bg: "#eff6ff", label: "Agendado"  },
  realizado: { cor: "#16a34a", bg: "#f0fdf4", label: "Realizado" },
  cancelado: { cor: "#dc2626", bg: "#fef2f2", label: "Cancelado" },
  falta:     { cor: "#ea580c", bg: "#fff7ed", label: "Falta"     }
};
const AGEN_STATUS_CICLO = ["agendado", "realizado", "falta", "cancelado"];
const AGEN_TIPO_EMOJI = {
  sessao: "ðŸ›‹ï¸", avaliacao: "ðŸ“‹", devolutiva: "ðŸ“¢",
  triagem: "ðŸ”", reuniao: "ðŸ¤", outro: "ðŸ“Œ"
};
const AGEN_TIPO_LABEL = {
  sessao: "SessÃ£o", avaliacao: "AvaliaÃ§Ã£o", devolutiva: "Devolutiva",
  triagem: "Triagem", reuniao: "ReuniÃ£o/SupervisÃ£o", outro: "Outro"
};
const FIN_STATUS_PAG = {
  pago:     { cor: "#16a34a", bg: "#f0fdf4", label: "Pago"     },
  pendente: { cor: "#ea580c", bg: "#fff7ed", label: "Pendente" },
  parcial:  { cor: "#d97706", bg: "#fffbeb", label: "Parcial"  },
  isento:   { cor: "#6b7280", bg: "#f9fafb", label: "Isento"   }
};
const FIN_FORMA_LABEL = {
  pix: "Pix", dinheiro: "Dinheiro", cartao_debito: "CartÃ£o DÃ©bito",
  cartao_credito: "CartÃ£o CrÃ©dito", transferencia: "TransferÃªncia",
  plano_saude: "Plano de SaÃºde", outro: "Outro"
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UTILITÃRIOS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmtBRL = v => (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function _hoje() { return new Date().toISOString().slice(0, 10); }

function _semanaIso() {
  const now  = new Date();
  const dia  = now.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const seg  = new Date(now); seg.setDate(now.getDate() + diff);
  const dom  = new Date(seg); dom.setDate(seg.getDate() + 6);
  return { inicio: seg.toISOString().slice(0, 10), fim: dom.toISOString().slice(0, 10) };
}

function _mesAtual()     { return new Date().toISOString().slice(0, 7); }
function _mesAnterior()  {
  const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7);
}

/** Quantas sessÃµes "realizado" um paciente jÃ¡ tem. */
function _numeroSessao(pacienteId) {
  if (!pacienteId) return 0;
  return DB_CLINICA.getMeusAgendamentos()
    .filter(a => a.pacienteId === pacienteId && a.status === "realizado").length;
}

/** PrÃ³ximo agendamento futuro nÃ£o cancelado. */
function _proximoAgendamento() {
  const hoje = _hoje();
  return DB_CLINICA.getMeusAgendamentos()
    .filter(a => a.status === "agendado" && a.data >= hoje)
    .sort((a, b) => {
      const d = a.data.localeCompare(b.data);
      return d !== 0 ? d : (a.horaInicio || "").localeCompare(b.horaInicio || "");
    })[0] || null;
}

/** Detecta conflito de horÃ¡rios */
function _detectarConflito(data, hIni, hFim, excluirId = null) {
  if (!data || !hIni) return null;
  return DB_CLINICA.getMeusAgendamentos().find(a => {
    if (excluirId && a.id === excluirId) return false;
    if (a.data !== data || a.status === "cancelado") return false;
    const aiIni = a.horaInicio || "00:00";
    const aiFim = a.horaFim   || "23:59";
    const noFim = hFim        || "23:59";
    return hIni < aiFim && noFim > aiIni;
  }) ?? null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INICIALIZAÃ‡ÃƒO / ROTEAMENTO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderizarClinica() {
  if (!DB_CLINICA._loaded) {
    await DB_CLINICA.carregar(usuarioLogado?.email || "", usuarioLogado?.role === "admin");
  }
  _renderOverview();
  _trocarAbaClin(_abaClinAtiva);
}

function _trocarAbaClin(aba) {
  _abaClinAtiva = aba;
  document.querySelectorAll(".clin-tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.aba === aba));
  document.querySelectorAll(".clin-tab-pane").forEach(p => {
    p.style.display = (p.id === "clin-pane-" + aba) ? "" : "none";
  });
  if (aba === "agenda")     _renderAgenda();
  if (aba === "financeiro") _renderFinanceiro();
  if (aba === "perfil")     _renderPerfil();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// OVERVIEW â€” mÃ©tricas globais no topo
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _renderOverview() {
  const hoje   = _hoje();
  const semana = _semanaIso();
  const mes    = _mesAtual();
  const mesAnt = _mesAnterior();
  const all    = DB_CLINICA.getMeusAgendamentos();
  const fin    = DB_CLINICA.getMeuFinanceiro();

  const hojeCount   = all.filter(a => a.data === hoje && a.status !== "cancelado").length;
  const semanaCount = all.filter(a => a.data >= semana.inicio && a.data <= semana.fim && a.status !== "cancelado").length;
  const receitaMes  = fin.filter(f => f.statusPag === "pago" && f.data?.startsWith(mes))
                         .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const receitaAnt  = fin.filter(f => f.statusPag === "pago" && f.data?.startsWith(mesAnt))
                         .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const pendentesN  = fin.filter(f => f.statusPag === "pendente").length;

  const el = id => document.getElementById(id);
  if (el("clin-m-hoje"))     el("clin-m-hoje").textContent     = hojeCount;
  if (el("clin-m-semana"))   el("clin-m-semana").textContent   = semanaCount;
  if (el("clin-m-receita"))  el("clin-m-receita").textContent  = fmtBRL(receitaMes);
  if (el("clin-m-pendentes")) el("clin-m-pendentes").textContent = pendentesN;

  // TendÃªncia de receita
  if (el("clin-m-receita-trend") && receitaAnt > 0) {
    const pct  = ((receitaMes - receitaAnt) / receitaAnt * 100).toFixed(0);
    const cor  = pct >= 0 ? "#16a34a" : "#dc2626";
    const seta = pct >= 0 ? "â†‘" : "â†“";
    el("clin-m-receita-trend").innerHTML =
      `<span style="color:${cor};font-weight:700">${seta} ${Math.abs(pct)}%</span> vs. mÃªs anterior`;
  }

  // Badge de pendentes na aba
  const tabFin = document.querySelector('.clin-tab-btn[data-aba="financeiro"] .clin-tab-notif');
  if (tabFin) { tabFin.textContent = pendentesN || ""; tabFin.style.display = pendentesN ? "" : "none"; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ABA: AGENDA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _renderAgenda() {
  _renderHojeStrip();
  _renderProximaSessao();

  const filtroData    = document.getElementById("agen-filtro-data")?.value   || "";
  const filtroStatus  = document.getElementById("agen-filtro-status")?.value || "";
  const filtroPeriodo = document.getElementById("agen-filtro-periodo")?.value || "";
  const filtroBusca   = (document.getElementById("agen-busca")?.value        || "").toLowerCase();

  const hoje   = _hoje();
  const semana = _semanaIso();
  const mes    = _mesAtual();

  let lista = DB_CLINICA.getMeusAgendamentos();
  if (filtroData)                    lista = lista.filter(a => a.data === filtroData);
  if (filtroStatus)                  lista = lista.filter(a => a.status === filtroStatus);
  if (filtroBusca)                   lista = lista.filter(a => (a.pacienteNome || "").toLowerCase().includes(filtroBusca));
  if (filtroPeriodo === "hoje")      lista = lista.filter(a => a.data === hoje);
  if (filtroPeriodo === "semana")    lista = lista.filter(a => a.data >= semana.inicio && a.data <= semana.fim);
  if (filtroPeriodo === "mes")       lista = lista.filter(a => a.data?.startsWith(mes));
  if (filtroPeriodo === "futuros")   lista = lista.filter(a => a.data >= hoje && a.status === "agendado");

  // Ordena: futuros e hoje primeiro (asc), depois passados (desc)
  const futuros  = lista.filter(a => a.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio||"").localeCompare(b.horaInicio||""));
  const passados = lista.filter(a => a.data < hoje)
    .sort((a, b) => b.data.localeCompare(a.data));
  lista = [...futuros, ...passados];

  const empty  = document.getElementById("agen-empty");
  const tabela = document.getElementById("agen-table");
  const tbody  = document.getElementById("tbody-agendamentos");

  if (!lista.length) {
    empty.style.display  = "block";
    tabela.style.display = "none";
    return;
  }
  empty.style.display  = "none";
  tabela.style.display = "";

  tbody.innerHTML = lista.map(a => {
    const si       = AGEN_STATUS_INFO[a.status] || { cor: "#6b7280", bg: "#f9fafb", label: a.status || "â€”" };
    const eHoje    = a.data === hoje;
    const dataFmt  = eHoje ? "ðŸŒ… Hoje" : (a.data ? new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR") : "â€”");
    const horario  = [a.horaInicio, a.horaFim].filter(Boolean).join(" â€“ ") || "â€”";
    const rowClass = a.status === "cancelado" ? "row-cancelado"
                   : a.status === "falta"     ? "row-falta"
                   : a.status === "realizado" ? "row-realizado"
                   : eHoje                    ? "row-hoje" : "";
    const badge    = `<span class="status-badge clickable"
                        style="background:${si.bg};color:${si.cor};border:1px solid ${si.cor}33"
                        title="Clique para avanÃ§ar o status"
                        onclick="toggleStatusAgendamento('${a.id}')">${si.label}</span>`;
    const numSessao = a.pacienteId
      ? (_numeroSessao(a.pacienteId) + (a.status === "agendado" ? 1 : 0))
      : "â€”";
    const emoji = AGEN_TIPO_EMOJI[a.tipo] || "ðŸ“Œ";
    return `<tr class="${rowClass}">
      <td style="white-space:nowrap;font-weight:${eHoje ? 700 : 400}">${dataFmt}</td>
      <td style="white-space:nowrap;font-weight:600">${horario}</td>
      <td style="font-weight:600">${a.pacienteNome || "â€”"}</td>
      <td><span title="${AGEN_TIPO_LABEL[a.tipo]||''}">${emoji} ${AGEN_TIPO_LABEL[a.tipo] || "Outro"}</span></td>
      <td style="text-align:center;font-weight:700;color:var(--text-muted);font-size:13px">#${numSessao}</td>
      <td>${badge}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${(a.obs||"").replace(/"/g,'&quot;')}">${a.obs || "â€”"}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary" style="padding:4px 9px;font-size:12px" title="Editar"  onclick="abrirModalAgendamento('${a.id}')">âœï¸</button>
          <button class="btn" style="padding:4px 9px;font-size:12px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5" title="Excluir" onclick="deletarAgendamentoUI('${a.id}')">ðŸ—‘ï¸</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function _renderHojeStrip() {
  const hoje  = _hoje();
  const lista = DB_CLINICA.getMeusAgendamentos()
    .filter(a => a.data === hoje)
    .sort((a, b) => (a.horaInicio||"").localeCompare(b.horaInicio||""));
  const strip = document.getElementById("hoje-strip");
  const cards = document.getElementById("hoje-cards");
  if (!strip || !cards) return;
  if (!lista.length) { strip.style.display = "none"; return; }
  strip.style.display = "";
  cards.innerHTML = lista.map(a => {
    const si      = AGEN_STATUS_INFO[a.status] || { cor: "#6b7280", bg: "#f9fafb" };
    const horario = [a.horaInicio, a.horaFim].filter(Boolean).join("â€“") || "?";
    const emoji   = AGEN_TIPO_EMOJI[a.tipo] || "ðŸ“Œ";
    return `<div class="hoje-card ${a.status}" onclick="abrirModalAgendamento('${a.id}')" title="Clique para editar">
      <div class="hoje-card-hora">${horario}</div>
      <div class="hoje-card-nome">${a.pacienteNome || "â€”"}</div>
      <div class="hoje-card-tipo">${emoji} ${AGEN_TIPO_LABEL[a.tipo]||"Outro"}</div>
      <div style="margin-top:6px">
        <span class="status-badge" style="background:${si.bg};color:${si.cor};border:1px solid ${si.cor}33;font-size:10px">
          ${AGEN_STATUS_INFO[a.status]?.label || a.status}
        </span>
      </div>
    </div>`;
  }).join("");
}

function _renderProximaSessao() {
  const prox = _proximoAgendamento();
  const el   = document.getElementById("clin-proxima");
  const info = document.getElementById("clin-proxima-info");
  if (!el || !info) return;
  if (!prox) { el.style.display = "none"; return; }
  el.style.display = "";
  const dataFmt = prox.data === _hoje()
    ? "hoje"
    : new Date(prox.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const horario = [prox.horaInicio, prox.horaFim].filter(Boolean).join(" â€“ ") || "";
  const numSessao = _numeroSessao(prox.pacienteId) + 1;
  info.textContent = `${prox.pacienteNome || "Paciente"} Â· ${dataFmt}${horario ? " Ã s " + horario : ""} Â· SessÃ£o #${numSessao}`;
}

/** AvanÃ§a o status no ciclo: agendado â†’ realizado â†’ falta â†’ cancelado â†’ agendado */
function toggleStatusAgendamento(id) {
  const a = DB_CLINICA.getMeusAgendamentos().find(x => x.id === id);
  if (!a) return;
  const idx    = AGEN_STATUS_CICLO.indexOf(a.status);
  const novoSt = AGEN_STATUS_CICLO[(idx + 1) % AGEN_STATUS_CICLO.length];
  DB_CLINICA.atualizarAgendamento(id, { status: novoSt });
  _renderAgenda();
  _renderOverview();
  _toast(`Status alterado para "${AGEN_STATUS_INFO[novoSt]?.label || novoSt}"`);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ABA: FINANCEIRO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _renderFinanceiro() {
  const filtroMes    = document.getElementById("fin-filtro-mes")?.value    || "";
  const filtroStatus = document.getElementById("fin-filtro-status")?.value || "";
  const filtroBusca  = (document.getElementById("fin-busca")?.value        || "").toLowerCase();

  let lista = DB_CLINICA.getMeuFinanceiro();
  lista = [...lista].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  if (filtroMes)    lista = lista.filter(f => f.data?.startsWith(filtroMes));
  if (filtroStatus) lista = lista.filter(f => f.statusPag === filtroStatus);
  if (filtroBusca)  lista = lista.filter(f =>
    (f.pacienteNome || "").toLowerCase().includes(filtroBusca) ||
    (f.obs || "").toLowerCase().includes(filtroBusca));

  // CÃ¡lculos
  const totalValor = lista.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const totalPago  = lista.filter(f => f.statusPag === "pago").reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const totalPend  = lista.filter(f => f.statusPag === "pendente").reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const nPago      = lista.filter(f => f.statusPag === "pago").length;
  const ticket     = nPago > 0 ? totalPago / nPago : 0;

  const el = id => document.getElementById(id);
  if (el("fin-total-valor"))  el("fin-total-valor").textContent  = fmtBRL(totalValor);
  if (el("fin-total-pago"))   el("fin-total-pago").textContent   = fmtBRL(totalPago);
  if (el("fin-total-pend"))   el("fin-total-pend").textContent   = fmtBRL(totalPend);
  if (el("fin-ticket-medio")) el("fin-ticket-medio").textContent = fmtBRL(ticket);
  if (el("fin-n-sessoes"))    el("fin-n-sessoes").textContent    = `${nPago} sessÃ£o(Ãµes) paga(s)`;

  // TendÃªncia: receita mÃªs atual vs. anterior (sobre todos os registros, nÃ£o apenas filtrados)
  const todaFin = DB_CLINICA.getMeuFinanceiro();
  const mes    = _mesAtual();
  const mesAnt = _mesAnterior();
  const pagoMes = todaFin.filter(f => f.statusPag === "pago" && f.data?.startsWith(mes))
                          .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  const pagoAnt = todaFin.filter(f => f.statusPag === "pago" && f.data?.startsWith(mesAnt))
                          .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
  if (el("fin-trend-pago") && pagoAnt > 0) {
    const pct = ((pagoMes - pagoAnt) / pagoAnt * 100).toFixed(0);
    const cor = pct >= 0 ? "#16a34a" : "#dc2626";
    el("fin-trend-pago").innerHTML = `<span style="color:${cor};font-weight:700">${pct >= 0 ? "â†‘" : "â†“"} ${Math.abs(pct)}%</span> vs. mÃªs anterior`;
  }

  // Meta mensal
  const perf = DB_CLINICA.getPerfil();
  const meta = parseFloat(perf?.metaMensal) || 0;
  const metaWrap = el("meta-bar-wrap");
  if (metaWrap) {
    if (meta > 0) {
      metaWrap.style.display = "";
      const pct = Math.min(100, Math.round(pagoMes / meta * 100));
      if (el("meta-bar-pct"))  el("meta-bar-pct").textContent  = pct + "%";
      if (el("meta-bar-fill")) el("meta-bar-fill").style.width = pct + "%";
      if (el("meta-bar-sub"))  el("meta-bar-sub").textContent  =
        `${fmtBRL(pagoMes)} de ${fmtBRL(meta)} Â· faltam ${fmtBRL(Math.max(0, meta - pagoMes))}`;
    } else {
      metaWrap.style.display = "none";
    }
  }

  // GrÃ¡fico
  _buildChartReceita();

  // Tabela
  const empty  = el("fin-empty");
  const tabela = el("fin-table");
  const tbody  = el("tbody-financeiro");

  if (!lista.length) { empty.style.display = "block"; tabela.style.display = "none"; return; }
  empty.style.display  = "none";
  tabela.style.display = "";

  tbody.innerHTML = lista.map(f => {
    const si    = FIN_STATUS_PAG[f.statusPag] || { cor: "#6b7280", bg: "#f9fafb", label: f.statusPag || "â€”" };
    const dataFmt = f.data ? new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR") : "â€”";
    const badge = `<span class="status-badge" style="background:${si.bg};color:${si.cor};border:1px solid ${si.cor}33">${si.label}</span>`;
    return `<tr>
      <td style="white-space:nowrap">${dataFmt}</td>
      <td style="font-weight:600">${f.pacienteNome || "â€”"}</td>
      <td style="font-weight:700;color:#16a34a">${fmtBRL(parseFloat(f.valor)||0)}</td>
      <td>${FIN_FORMA_LABEL[f.formaPagamento] || f.formaPagamento || "â€”"}</td>
      <td>${badge}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${(f.obs||"").replace(/"/g,'&quot;')}">${f.obs || "â€”"}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn" style="padding:4px 9px;font-size:12px;background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0"
                  title="Copiar mensagem de cobranÃ§a para WhatsApp" onclick="copiarMsgCobranca('${f.id}')">ðŸ’¬</button>
          <button class="btn btn-secondary" style="padding:4px 9px;font-size:12px" title="Editar" onclick="abrirModalFinanceiro('${f.id}')">âœï¸</button>
          <button class="btn" style="padding:4px 9px;font-size:12px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5" title="Excluir" onclick="deletarFinanceiroUI('${f.id}')">ðŸ—‘ï¸</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

/** GrÃ¡fico de receita (Ãºltimos 6 meses) com Chart.js */
function _buildChartReceita() {
  const canvas = document.getElementById("chart-receita");
  if (!canvas || typeof Chart === "undefined") return;
  const todaFin = DB_CLINICA.getMeuFinanceiro();
  const agora   = new Date();
  const meses = [], valores = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const key   = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const total = todaFin.filter(f => f.statusPag === "pago" && f.data?.startsWith(key))
                         .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
    meses.push(label);
    valores.push(total);
  }
  if (_chartReceita) { _chartReceita.destroy(); _chartReceita = null; }
  _chartReceita = new Chart(canvas, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [{
        label: "Receita (R$)",
        data: valores,
        backgroundColor: valores.map((_, i) => i === 5 ? "#1d4ed8" : "rgba(109,40,217,.35)"),
        borderRadius: 7,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmtBRL(ctx.parsed.y) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => "R$ " + v.toLocaleString("pt-BR") },
          grid: { color: "rgba(0,0,0,.05)" }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/** Exporta todos os registros para CSV com BOM (funciona no Excel). */
function exportarCSVFinanceiro() {
  const lista = DB_CLINICA.getMeuFinanceiro();
  if (!lista.length) { alert("Nenhum registro para exportar."); return; }
  const cabecalho = ["Data", "Paciente", "Valor (R$)", "Forma Pagamento", "Status", "ObservaÃ§Ãµes"];
  const linhas = lista.map(f => [
    f.data || "",
    `"${(f.pacienteNome || "").replace(/"/g, '""')}"`,
    (parseFloat(f.valor) || 0).toFixed(2).replace(".", ","),
    FIN_FORMA_LABEL[f.formaPagamento] || f.formaPagamento || "",
    FIN_STATUS_PAG[f.statusPag]?.label || f.statusPag || "",
    `"${(f.obs || "").replace(/"/g, '""')}"`
  ].join(";"));
  const csv  = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `financeiro_${_mesAtual()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  _toast("ðŸ“¥ CSV exportado com sucesso!");
}

/** Gera e copia mensagem de cobranÃ§a para o WhatsApp (clipboard). */
async function copiarMsgCobranca(finId) {
  const f        = DB_CLINICA.getMeuFinanceiro().find(x => x.id === finId);
  if (!f) return;
  const perf     = DB_CLINICA.getPerfil();
  const clinNome = perf?.nome || usuarioLogado?.nome || "PsicÃ³loga(o)";
  const dataFmt  = f.data ? new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR") : "";
  const status   = f.statusPag === "pago" ? "âœ… *Pagamento confirmado!*" : "â³ *Pagamento pendente*";
  const msg = `OlÃ¡, ${f.pacienteNome || ""}! ðŸ˜Š\n\n${status}\n\n` +
    `ðŸ“… *Data da sessÃ£o:* ${dataFmt}\n` +
    `ðŸ’° *Valor:* ${fmtBRL(parseFloat(f.valor)||0)}\n` +
    `ðŸ’³ *Forma de pagamento:* ${FIN_FORMA_LABEL[f.formaPagamento] || f.formaPagamento || "â€”"}\n` +
    `\nQualquer dÃºvida, estou Ã  disposiÃ§Ã£o! ðŸ™\nâ€” *${clinNome}*`;
  try {
    await navigator.clipboard.writeText(msg);
    _toast("ðŸ’¬ Mensagem copiada! Cole no WhatsApp.");
  } catch {
    prompt("Copie a mensagem abaixo:", msg);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ABA: PERFIL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _renderPerfil() {
  const p = DB_CLINICA.getPerfil();
  if (!p) return;
  const mapa = {
    "clin-nome": "nome", "clin-cnpj": "cnpj",
    "clin-end": "endereco", "clin-tel": "telefone",
    "clin-email": "emailClinica", "clin-site": "site",
    "clin-hora": "horario", "clin-obs": "obs",
    "clin-val-padrao": "valorPadrao",
    "clin-duracao-padrao": "duracaoPadrao",
    "clin-meta-mensal": "metaMensal"
  };
  Object.entries(mapa).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = p[key] || "";
  });
}

async function salvarPerfilClinica() {
  const mapa = {
    "clin-nome": "nome", "clin-cnpj": "cnpj",
    "clin-end": "endereco", "clin-tel": "telefone",
    "clin-email": "emailClinica", "clin-site": "site",
    "clin-hora": "horario", "clin-obs": "obs",
    "clin-val-padrao": "valorPadrao",
    "clin-duracao-padrao": "duracaoPadrao",
    "clin-meta-mensal": "metaMensal"
  };
  const dados = {};
  Object.entries(mapa).forEach(([id, key]) => {
    dados[key] = (document.getElementById(id)?.value || "").trim();
  });
  const btn = document.getElementById("clin-btn-salvar");
  const err = document.getElementById("clin-perfil-err");
  if (err) err.classList.add("hidden");
  btn.textContent = "Salvandoâ€¦";
  btn.disabled    = true;
  try {
    await DB_CLINICA.salvarPerfil(usuarioLogado.email, dados);
    btn.textContent = "âœ… ConfiguraÃ§Ãµes salvas!";
    setTimeout(() => { btn.textContent = "ðŸ’¾ Salvar ConfiguraÃ§Ãµes"; btn.disabled = false; }, 2400);
    _renderOverview();
    _toast("âœ… ConfiguraÃ§Ãµes da clÃ­nica salvas!");
  } catch (e) {
    btn.textContent = "Erro â€” tente novamente";
    btn.disabled    = false;
    if (err) { err.textContent = String(e); err.classList.remove("hidden"); }
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MODAL â€” AGENDAMENTO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function abrirModalAgendamento(id = null, pacienteIdPresel = null) {
  _editandoAgenId = id;
  document.getElementById("modal-agen-titulo").textContent = id ? "âœï¸ Editar Agendamento" : "ðŸ“… Novo Agendamento";

  const sel = document.getElementById("agen-f-paciente");
  sel.innerHTML = '<option value="">â€” Selecione o paciente â€”</option>';
  DB_PAC.getMeus().forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id; opt.dataset.nome = p.nome; opt.textContent = p.nome;
    sel.appendChild(opt);
  });

  document.getElementById("agen-err").classList.add("hidden");
  document.getElementById("agen-conflito").style.display = "none";

  if (id) {
    const a = DB_CLINICA.getMeusAgendamentos().find(x => x.id === id);
    if (a) {
      sel.value = a.pacienteId || "";
      document.getElementById("agen-f-data").value     = a.data       || "";
      document.getElementById("agen-f-hora-ini").value = a.horaInicio || "";
      document.getElementById("agen-f-hora-fim").value = a.horaFim    || "";
      document.getElementById("agen-f-tipo").value     = a.tipo       || "sessao";
      document.getElementById("agen-f-status").value   = a.status     || "agendado";
      document.getElementById("agen-f-obs").value      = a.obs        || "";
      document.getElementById("agen-f-repetir").checked = false;
    }
  } else {
    sel.value = pacienteIdPresel || "";
    document.getElementById("agen-f-data").value     = _hoje();
    document.getElementById("agen-f-hora-ini").value = "";
    document.getElementById("agen-f-hora-fim").value = "";
    document.getElementById("agen-f-tipo").value     = "sessao";
    document.getElementById("agen-f-status").value   = "agendado";
    document.getElementById("agen-f-obs").value      = "";
    document.getElementById("agen-f-repetir").checked = false;
  }
  document.getElementById("modal-agen-overlay").classList.remove("hidden");
}

function fecharModalAgendamento() {
  document.getElementById("modal-agen-overlay").classList.add("hidden");
  _editandoAgenId = null;
}

/** Auto-preenche hora fim com base na duraÃ§Ã£o padrÃ£o configurada. */
function autoPreencherHoraFim() {
  const hIni = document.getElementById("agen-f-hora-ini").value;
  const dur  = parseInt(DB_CLINICA.getPerfil()?.duracaoPadrao) || 0;
  if (hIni && dur) {
    const [h, m] = hIni.split(":").map(Number);
    const total  = h * 60 + m + dur;
    const hFim   = String(Math.floor(total / 60) % 24).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
    document.getElementById("agen-f-hora-fim").value = hFim;
  }
  _verificarConflitoCampos();
}

function _verificarConflitoCampos() {
  const data  = document.getElementById("agen-f-data").value;
  const hIni  = document.getElementById("agen-f-hora-ini").value;
  const hFim  = document.getElementById("agen-f-hora-fim").value;
  const alrt  = document.getElementById("agen-conflito");
  if (!alrt) return;
  const c = _detectarConflito(data, hIni, hFim, _editandoAgenId);
  if (c) {
    alrt.textContent = `âš ï¸ Conflito com ${c.pacienteNome || "outro paciente"} (${c.horaInicio || "?"}â€“${c.horaFim || "?"}).`;
    alrt.style.display = "";
  } else {
    alrt.style.display = "none";
  }
}

function salvarAgendamento() {
  const errDiv = document.getElementById("agen-err");
  errDiv.classList.add("hidden");

  const sel           = document.getElementById("agen-f-paciente");
  const pacienteId    = sel.value;
  const pacienteNome  = sel.options[sel.selectedIndex]?.dataset.nome || "";
  const data          = document.getElementById("agen-f-data").value;
  const horaInicio    = document.getElementById("agen-f-hora-ini").value;
  const horaFim       = document.getElementById("agen-f-hora-fim").value;
  const tipo          = document.getElementById("agen-f-tipo").value;
  const status        = document.getElementById("agen-f-status").value;
  const obs           = document.getElementById("agen-f-obs").value.trim();
  const repetir       = document.getElementById("agen-f-repetir").checked;

  if (!data) {
    errDiv.textContent = "Informe a data do agendamento.";
    errDiv.classList.remove("hidden");
    return;
  }

  const dados = { pacienteId, pacienteNome, data, horaInicio, horaFim, tipo, status, obs };

  if (_editandoAgenId) {
    DB_CLINICA.atualizarAgendamento(_editandoAgenId, dados);
    _toast("âœ… Agendamento atualizado!");
  } else {
    DB_CLINICA.criarAgendamento(dados);
    if (repetir) {
      for (let s = 1; s <= 4; s++) {
        const d = new Date(data + "T00:00:00");
        d.setDate(d.getDate() + s * 7);
        DB_CLINICA.criarAgendamento({ ...dados, data: d.toISOString().slice(0, 10) });
      }
      _toast("ðŸ“… 5 agendamentos criados (semanal â€” 4 semanas).");
    } else {
      _toast("ðŸ“… Agendamento criado!");
    }
  }

  fecharModalAgendamento();
  _renderAgenda();
  _renderOverview();
}

function deletarAgendamentoUI(id) {
  if (!confirm("Excluir este agendamento? Esta aÃ§Ã£o nÃ£o pode ser desfeita.")) return;
  DB_CLINICA.deletarAgendamento(id);
  _renderAgenda();
  _renderOverview();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MODAL â€” FINANCEIRO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function abrirModalFinanceiro(id = null, pacienteIdPresel = null) {
  _editandoFinId = id;
  document.getElementById("modal-fin-titulo").textContent = id ? "âœï¸ Editar Registro" : "ðŸ’° Novo Registro Financeiro";

  const sel = document.getElementById("fin-f-paciente");
  sel.innerHTML = '<option value="">â€” Selecione o paciente â€”</option>';
  DB_PAC.getMeus().forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id; opt.dataset.nome = p.nome; opt.textContent = p.nome;
    sel.appendChild(opt);
  });

  document.getElementById("fin-err").classList.add("hidden");
  const valorPad = DB_CLINICA.getPerfil()?.valorPadrao || "";

  if (id) {
    const f = DB_CLINICA.getMeuFinanceiro().find(x => x.id === id);
    if (f) {
      sel.value = f.pacienteId || "";
      document.getElementById("fin-f-data").value   = f.data           || "";
      document.getElementById("fin-f-valor").value  = f.valor          || "";
      document.getElementById("fin-f-forma").value  = f.formaPagamento || "pix";
      document.getElementById("fin-f-status").value = f.statusPag      || "pago";
      document.getElementById("fin-f-obs").value    = f.obs            || "";
    }
  } else {
    sel.value = pacienteIdPresel || "";
    document.getElementById("fin-f-data").value   = _hoje();
    document.getElementById("fin-f-valor").value  = valorPad;
    document.getElementById("fin-f-forma").value  = "pix";
    document.getElementById("fin-f-status").value = "pago";
    document.getElementById("fin-f-obs").value    = "";
  }
  document.getElementById("modal-fin-overlay").classList.remove("hidden");
}

function fecharModalFinanceiro() {
  document.getElementById("modal-fin-overlay").classList.add("hidden");
  _editandoFinId = null;
}

function salvarFinanceiro() {
  const errDiv = document.getElementById("fin-err");
  errDiv.classList.add("hidden");

  const sel          = document.getElementById("fin-f-paciente");
  const pacienteId   = sel.value;
  const pacienteNome = sel.options[sel.selectedIndex]?.dataset.nome || "";
  const data         = document.getElementById("fin-f-data").value;
  const valor        = parseFloat(document.getElementById("fin-f-valor").value.replace(",", "."));
  const formaPagamento = document.getElementById("fin-f-forma").value;
  const statusPag    = document.getElementById("fin-f-status").value;
  const obs          = document.getElementById("fin-f-obs").value.trim();

  if (!data) {
    errDiv.textContent = "Informe a data do registro.";
    errDiv.classList.remove("hidden"); return;
  }
  if (isNaN(valor) || valor < 0) {
    errDiv.textContent = "Informe um valor vÃ¡lido (ex: 150.00).";
    errDiv.classList.remove("hidden"); return;
  }

  const dados = { pacienteId, pacienteNome, data, valor, formaPagamento, statusPag, obs };

  if (_editandoFinId) {
    DB_CLINICA.atualizarFinanceiro(_editandoFinId, dados);
    _toast("âœ… Registro atualizado!");
  } else {
    DB_CLINICA.criarFinanceiro(dados);
    _toast("ðŸ’° Registro financeiro criado!");
  }

  fecharModalFinanceiro();
  _renderFinanceiro();
  _renderOverview();
}

function deletarFinanceiroUI(id) {
  if (!confirm("Excluir este registro financeiro? Esta aÃ§Ã£o nÃ£o pode ser desfeita.")) return;
  DB_CLINICA.deletarFinanceiro(id);
  _renderFinanceiro();
  _renderOverview();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TOAST â€” feedback visual leve
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _toast(msg, dur = 3000) {
  let el = document.getElementById("clin-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "clin-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity   = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity   = "0";
    el.style.transform = "translateX(-50%) translateY(20px)";
  }, dur);
}

