/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/navigation.js
   Roteamento SPA e controle de sidebar.

   Depende em runtime de:
     limparFormulario    → modules/neupsilin/avaliacao.js
     limparFormularioInf → modules/neupsilin/avaliacao-inf.js
     limparWISC          → modules/wisc/avaliacao.js
     limparBFP           → modules/bfp/avaliacao.js
     inicializarBFPForm  → modules/bfp/avaliacao.js
     renderizarHistorico, renderizarPacientes, renderizarUsuarios → script.js
═══════════════════════════════════════════════════════ */

/**
 * Navega para uma seção do SPA, ocultando as demais.
 * @param {string}       secao  - chave da seção (ex.: "wisc", "dashboard")
 * @param {HTMLElement|null} linkEl - item de nav que deve ficar "active"
 */
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
    dashboard:        "Dashboard",
    testes:           "Correção de Testes",
    "nova-avaliacao": "NEUPSILIN Adulto — Correção",
    "neupsilin-inf":  "NEUPSILIN-INF — Correção Infantil",
    wisc:             "WISC-IV — Correção",
    aplicacao:        "Aplicação de Testes",
    bfp:              "BFP — Bateria Fatorial de Personalidade",
    historico:        "Histórico de Avaliações",
    pacientes:        "Pacientes",
    clinica:          "Gestão da Clínica",
    usuarios:         "Gerenciar Usuários"
  };
  document.getElementById("topbar-title").textContent = titulos[secao] || secao;

  // Ações de inicialização por seção
  if (secao === "historico")      renderizarHistorico();
  if (secao === "pacientes")      renderizarPacientes();
  if (secao === "clinica")        renderizarClinica();
  if (secao === "usuarios")       renderizarUsuarios();
  if (secao === "nova-avaliacao") limparFormulario();
  if (secao === "neupsilin-inf")  limparFormularioInf();
  if (secao === "wisc")           limparWISC();
  if (secao === "bfp")            { limparBFP(); inicializarBFPForm(); }
}

/** Alterna abertura/fechamento da sidebar no mobile. */
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}
