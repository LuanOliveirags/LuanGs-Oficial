/* ═══════════════════════════════════════════════════════
   NEUPSILIN-INF — avaliacao-inf.js
   Correção automática da versão Infantil (6–12 anos 11 m)
═══════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────
// INICIALIZAÇÃO (Event listeners próprios da seção INF)
// ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Abas INF
  document.querySelectorAll(".ninf-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.ninfTab;
      document.querySelectorAll(".ninf-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".ninf-tab-content").forEach(c => {
        c.classList.remove("active");
        c.classList.add("hidden");
      });
      btn.classList.add("active");
      const cont = document.getElementById("ninf-tab-" + tabId);
      if (cont) { cont.classList.remove("hidden"); cont.classList.add("active"); }
    });
  });

  // Subtotais em tempo real — INF
  document.querySelectorAll(".ninf-score").forEach(inp => {
    inp.addEventListener("input", atualizarSubtotalInf);
  });
});

// ──────────────────────────────────────────────────────
// SUBTOTAIS EM TEMPO REAL
// ──────────────────────────────────────────────────────
function atualizarSubtotalInf(e) {
  const area = e.target.dataset.area;
  if (!area) return;
  let soma = 0;
  document.querySelectorAll(`#sec-neupsilin-inf .ninf-score[data-area="${area}"]`).forEach(inp => {
    soma += parseInt(inp.value) || 0;
  });
  const el = document.getElementById("ninf-sub-" + area);
  if (el) el.textContent = soma;
}

// ──────────────────────────────────────────────────────
// CALCULAR & SALVAR — INF
// ──────────────────────────────────────────────────────
function calcularESalvarInf() {
  const nome  = document.getElementById("ninf-nome").value.trim();
  const nasc  = document.getElementById("ninf-nasc").value;
  const serie = document.getElementById("ninf-serie").value;
  const sexo  = document.getElementById("ninf-sexo").value;

  if (!nome || !nasc) {
    alert("Preencha Nome e Data de Nascimento da criança.");
    return;
  }

  const idade = calcularIdade(nasc);
  if (idade < 6 || idade > 12) {
    alert("Faixa etária fora do normativo do NEUPSILIN-INF (6 a 12 anos e 11 meses).");
    return;
  }

  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const escores = {};
  for (const area of areas) {
    const subs = {};
    let total = 0;
    document.querySelectorAll(`#sec-neupsilin-inf .ninf-score[data-area="${area}"]`).forEach(inp => {
      const val = Math.min(parseInt(inp.value) || 0, parseInt(inp.max) || 9999);
      subs[inp.dataset.sub] = val;
      total += val;
    });
    escores[area] = { total, subs };
  }

  const resultados = {};
  const zList = [];
  for (const area of areas) {
    const r = calcularZAreaInf(area, escores[area].total, idade);
    resultados[area] = { ...r, score: escores[area].total, max: MAX_SCORES_INF[area], subs: escores[area].subs };
    zList.push(r.z);
  }

  const classeGeral = classificacaoGeral(zList);
  const totalBruto  = Object.values(escores).reduce((a, v) => a + v.total, 0);
  const maxTotal    = Object.values(MAX_SCORES_INF).reduce((a, b) => a + b, 0);

  const avaliacao = {
    id: Date.now(),
    tipoTeste: "NEUPSILIN-INF",
    data: new Date().toISOString(),
    profissional: usuarioLogado,
    paciente: { nome, nasc, serie, sexo, idade },
    escores,
    resultados,
    totalBruto,
    maxTotal,
    classeGeral,
    obs: document.getElementById("ninf-obs").value.trim()
  };

  salvarAvaliacao(avaliacao);
  avaliacaoAtivaInf = avaliacao;

  renderizarResultadoInlineInf(avaliacao);
  atualizarStats();
}

// ──────────────────────────────────────────────────────
// RENDER: Resultado inline — INF
// ──────────────────────────────────────────────────────
let avaliacaoAtivaInf = null;

function renderizarResultadoInlineInf(av) {
  const div = document.getElementById("ninf-resultado-conteudo");
  div.innerHTML = buildResultadoHTMLInf(av, "inline");

  const card = document.getElementById("ninf-resultado-inline");
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  requestAnimationFrame(() => renderizarGraficosInf(av, "inline"));
}

function buildResultadoHTMLInf(av, ctx) {
  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const serieMap = {
    EF1:"1º ano EF", EF2:"2º ano EF", EF3:"3º ano EF", EF4:"4º ano EF",
    EF5:"5º ano EF", EF6:"6º ano EF", EF7:"7º ano EF", NEE: "Não frequenta"
  };

  let areasHTML = "";
  for (const area of areas) {
    const r = av.resultados[area];
    const pct = Math.round((r.score / r.max) * 100);
    areasHTML += `
      <div class="resultado-area">
        <div class="area-nome">${AREA_NOMES_INF[area]}</div>
        <div class="area-score">${r.score}<span class="area-max">/${r.max}</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin:2px 0">z = ${r.z.toFixed(2)} &nbsp;|&nbsp; ${pct}%</div>
        <div class="area-class"><span class="badge ${r.classe.badge}">${r.classe.label}</span></div>
      </div>`;
  }

  const interp = gerarInterpretacaoInf(av);
  const serieLabel = serieMap[av.paciente.serie] || av.paciente.serie || "Não informado";

  return `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">
      <strong>${av.paciente.nome}</strong> &nbsp;|&nbsp;
      ${av.paciente.idade} anos &nbsp;|&nbsp;
      ${serieLabel} &nbsp;|&nbsp;
      Correção em: ${formatarData(av.data)}
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
      <div class="grafico-box"><p class="grafico-titulo">Perfil por z-score (Radar)</p><div class="grafico-wrap"><canvas id="ninf-chart-radar-${ctx}"></canvas></div></div>
      <div class="grafico-box"><p class="grafico-titulo">Desempenho por Área (%)</p><div class="grafico-wrap"><canvas id="ninf-chart-barras-${ctx}"></canvas></div></div>
    </div>
    <div class="resultado-interp"><strong>Interpretação:</strong><br>${interp}</div>`;
}

// ──────────────────────────────────────────────────────
// GRÁFICOS — INF
// ──────────────────────────────────────────────────────
function renderizarGraficosInf(av, ctx) {
  const areas  = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const labels = ["Orientação","Atenção","Percepção","Memória","Hab. Aritm.","Linguagem","Funç. Exec.","Praxias"];

  const corPorZ = z => {
    if (z >= 1.0)  return { bg: "rgba(22,163,74,0.7)",   brd: "rgb(22,163,74)" };
    if (z >= 0.5)  return { bg: "rgba(5,150,105,0.7)",   brd: "rgb(5,150,105)" };
    if (z >= -0.5) return { bg: "rgba(37,99,235,0.7)",   brd: "rgb(37,99,235)" };
    if (z >= -1.0) return { bg: "rgba(217,119,6,0.7)",   brd: "rgb(217,119,6)" };
    return           { bg: "rgba(220,38,38,0.7)",    brd: "rgb(220,38,38)" };
  };

  const cores = areas.map(a => corPorZ(av.resultados[a].z));

  if (_charts[`ninf_radar_${ctx}`])  _charts[`ninf_radar_${ctx}`].destroy();
  if (_charts[`ninf_barras_${ctx}`]) _charts[`ninf_barras_${ctx}`].destroy();

  const canvasRadar = document.getElementById(`ninf-chart-radar-${ctx}`);
  if (canvasRadar) {
    _charts[`ninf_radar_${ctx}`] = new Chart(canvasRadar, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Paciente (z)",
            data: areas.map(a => +av.resultados[a].z.toFixed(2)),
            backgroundColor: "rgba(16,185,129,0.12)",
            borderColor: "rgba(16,185,129,0.9)",
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
          tooltip: { callbacks: { label: c => ` z = ${c.raw}` } }
        }
      }
    });
  }

  const canvasBar = document.getElementById(`ninf-chart-barras-${ctx}`);
  if (canvasBar) {
    _charts[`ninf_barras_${ctx}`] = new Chart(canvasBar, {
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
          y: { min: 0, max: 100, ticks: { callback: v => v + "%", font: { size: 11 } }, grid: { color: "rgba(0,0,0,0.05)" } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}%` } }
        }
      }
    });
  }
}

// ──────────────────────────────────────────────────────
// INTERPRETAÇÃO — INF
// ──────────────────────────────────────────────────────
function gerarInterpretacaoInf(av) {
  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  const fracos = areas.filter(a => av.resultados[a].z < -1.0).map(a => AREA_NOMES_INF[a]);
  const fortes = areas.filter(a => av.resultados[a].z >= 1.0).map(a => AREA_NOMES_INF[a]);

  let txt = `O desempenho geral de <strong>${av.paciente.nome}</strong> (${av.paciente.idade} anos) `;
  txt += `foi classificado como <strong>${av.classeGeral.label}</strong>, ${av.classeGeral.interp}. `;

  if (fortes.length)
    txt += `Destacaram-se positivamente: <em>${fortes.join(", ")}</em>. `;

  if (fracos.length)
    txt += `Foram observados escores abaixo do esperado para a faixa etária em: <em>${fracos.join(", ")}</em>, sugerindo necessidade de avaliação complementar. `;
  else
    txt += `Não foram identificadas áreas com desempenho significativamente abaixo da média para crianças de ${av.paciente.idade} anos. `;

  txt += `Os escores foram comparados às normas do NEUPSILIN-INF para a faixa etária de ${av.paciente.idade} anos.`;
  return txt;
}

// ──────────────────────────────────────────────────────
// LIMPAR FORMULÁRIO — INF
// ──────────────────────────────────────────────────────
function limparFormularioInf() {
  document.getElementById("ninf-nome").value  = "";
  document.getElementById("ninf-nasc").value  = "";
  document.getElementById("ninf-serie").value = "";
  document.getElementById("ninf-obs").value   = "";
  document.querySelectorAll("#sec-neupsilin-inf .ninf-score").forEach(inp => inp.value = "");
  ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"].forEach(a => {
    const el = document.getElementById("ninf-sub-" + a);
    if (el) el.textContent = "0";
  });
  const res = document.getElementById("ninf-resultado-inline");
  if (res) res.classList.add("hidden");
  avaliacaoAtivaInf = null;
}

// ──────────────────────────────────────────────────────
// EXPORTAR PDF — INF
// ──────────────────────────────────────────────────────
function exportarPDFInf(avParam) {
  const av = avParam || avaliacaoAtivaInf;
  if (!av) { alert("Nenhuma correção para exportar."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const L = 20, R = 190, W = R - L;
  let   Y = 20;
  const cor    = [16, 185, 129]; // verde INF
  const cinza  = [100, 116, 139];
  const preto  = [30, 41, 59];

  // Cabeçalho
  doc.setFillColor(...cor);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("NEUPSILIN-INF", L, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Instrumento de Avaliação Neuropsicológica Breve — Versão Infantil", L, 20);
  doc.text("LAUDO DE CORREÇÃO AUTOMÁTICA", L, 26);
  doc.setFontSize(8);
  doc.text(`Profissional: ${av.profissional.nome}`, R, 16, { align: "right" });
  doc.text(`${av.profissional.crp || ""}`, R, 21, { align: "right" });
  doc.text(`Data: ${formatarData(av.data)}`, R, 26, { align: "right" });

  Y = 42;

  // Dados da criança
  const serieMap = {
    EF1:"1º ano EF", EF2:"2º ano EF", EF3:"3º ano EF", EF4:"4º ano EF",
    EF5:"5º ano EF", EF6:"6º ano EF", EF7:"7º ano EF", NEE:"Não frequenta"
  };
  doc.setFillColor(248, 250, 252);
  doc.rect(L, Y - 5, W, 24, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(L, Y - 5, W, 24);
  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DA CRIANÇA", L + 4, Y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${av.paciente.nome}`, L + 4, Y + 7);
  doc.text(`Idade: ${av.paciente.idade} anos  |  Nascimento: ${formatarDataBR(av.paciente.nasc)}  |  Sexo: ${av.paciente.sexo === "M" ? "Masculino" : "Feminino"}`, L + 4, Y + 13);
  doc.text(`Escolaridade: ${serieMap[av.paciente.serie] || av.paciente.serie || "—"}  |  Faixa normativa: ${av.paciente.idade} anos`, L + 4, Y + 19);
  Y += 30;

  // Resultado geral
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

  // Tabela por área
  doc.setTextColor(...preto);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RESULTADOS POR ÁREA", L, Y);
  Y += 7;

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
  let row = 0;
  for (const area of areas) {
    const r   = av.resultados[area];
    const pct = Math.round((r.score / r.max) * 100);
    const odd = row++ % 2 === 0;
    if (odd) {
      doc.setFillColor(248, 250, 252);
      doc.rect(L, Y, W, rowH, "F");
    }
    doc.setTextColor(...preto);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(AREA_NOMES_INF[area], cols[0] + 2, Y + 5);
    doc.text(`${r.score} / ${r.max}`, cols[1] + 2, Y + 5);
    doc.text(`${pct}%`, cols[2] + 2, Y + 5);
    doc.text(r.z.toFixed(2), cols[3] + 2, Y + 5);
    doc.text(r.media.toFixed(1), cols[4] + 2, Y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(r.classe.label, cols[5] + 2, Y + 5);
    doc.setFont("helvetica", "normal");
    Y += rowH;
  }

  // Borda tabela
  doc.setDrawColor(226, 232, 240);
  doc.rect(L, Y - rowH * areas.length - rowH, W, rowH * (areas.length + 1));
  Y += 8;

  // Interpretação
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...preto);
  doc.text("INTERPRETAÇÃO CLÍNICA", L, Y);
  Y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const interp = gerarInterpretacaoInf(av).replace(/<[^>]+>/g, "");
  const linhas = doc.splitTextToSize(interp, W);
  doc.text(linhas, L, Y);
  Y += linhas.length * 5 + 6;

  // Observações
  if (av.obs) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("OBSERVAÇÕES CLÍNICAS", L, Y);
    Y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const obsLinhas = doc.splitTextToSize(av.obs, W);
    doc.text(obsLinhas, L, Y);
    Y += obsLinhas.length * 5 + 6;
  }

  // Assinatura
  Y = Math.max(Y, 240);
  doc.setDrawColor(...cor);
  doc.line(L, Y, L + 70, Y);
  doc.setFontSize(8);
  doc.setTextColor(...cinza);
  doc.text(av.profissional.nome, L, Y + 5);
  doc.text(av.profissional.crp || "", L, Y + 10);

  const nomeArq = `NEUPSILIN-INF_${av.paciente.nome.replace(/\s+/g, "_")}_${new Date(av.data).toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
  doc.save(nomeArq);
}
