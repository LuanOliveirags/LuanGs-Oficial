/* ═══════════════════════════════════════════════════════
   NEUPSILIN — avaliacao.js
   Cálculo, renderização de resultados e exportação PDF
═══════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────────────
// SUBTOTAIS EM TEMPO REAL
// ──────────────────────────────────────────────────────
function atualizarSubtotal(e) {
  const area = e.target.dataset.area;
  if (!area) return;
  let soma = 0;
  document.querySelectorAll(`.score-input[data-area="${area}"]`).forEach(inp => {
    soma += parseInt(inp.value) || 0;
  });
  const el = document.getElementById("sub-" + area);
  if (el) el.textContent = soma;
}

// ──────────────────────────────────────────────────────
// CALCULAR & SALVAR
// ──────────────────────────────────────────────────────
function calcularEsalvar() {
  const nome = document.getElementById("pac-nome").value.trim();
  const nasc = document.getElementById("pac-nasc").value;
  const esc  = document.getElementById("pac-esc").value;
  const sexo = document.getElementById("pac-sexo").value;

  if (!nome || !nasc || !esc) {
    alert("Preencha Nome, Data de Nascimento e Escolaridade do paciente.");
    return;
  }

  const idade = calcularIdade(nasc);
  if (idade < 12 || idade > 90) {
    alert("Idade fora do intervalo normativo do NEUPSILIN Adulto (12–90 anos).\nPara crianças de 6–12 anos, utilize o NEUPSILIN-INF.");
    return;
  }

  // Coleta escores por área
  const escores = {};
  const areas = ["orientacao","atencao","percepcao","memoria","habilidades","linguagem","funcoes","praxias"];
  for (const area of areas) {
    const subs = {};
    let total = 0;
    document.querySelectorAll(`.score-input[data-area="${area}"]`).forEach(inp => {
      const val = Math.min(parseInt(inp.value) || 0, parseInt(inp.max));
      subs[inp.dataset.sub] = val;
      total += val;
    });
    escores[area] = { total, subs };
  }

  // Calcula z-scores
  const resultados = {};
  const zList = [];
  for (const area of areas) {
    const r = calcularZArea(area, escores[area].total, esc, idade);
    resultados[area] = { ...r, score: escores[area].total, max: MAX_SCORES[area], subs: escores[area].subs };
    zList.push(r.z);
  }

  const classeGeral = classificacaoGeral(zList);
  const totalBruto  = Object.values(escores).reduce((a, v) => a + v.total, 0);
  const maxTotal    = Object.values(MAX_SCORES).reduce((a, b) => a + b, 0);

  const avaliacao = {
    id: Date.now(),
    tipoTeste: "NEUPSILIN-ADULTO",
    data: new Date().toISOString(),
    profissional: usuarioLogado,
    paciente: { nome, nasc, esc, sexo, idade },
    escores,
    resultados,
    totalBruto,
    maxTotal,
    classeGeral,
    obs: document.getElementById("obs-clinicas").value.trim()
  };

  salvarAvaliacao(avaliacao);
  avaliacaoAtiva = avaliacao;

  renderizarResultadoInline(avaliacao);
  atualizarStats();
}

// ──────────────────────────────────────────────────────
// RENDER: Resultado inline
// ──────────────────────────────────────────────────────
function renderizarResultadoInline(av) {
  const div = document.getElementById("resultado-conteudo");
  div.innerHTML = buildResultadoHTML(av, "inline");

  const card = document.getElementById("resultado-inline");
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  // Pequeno delay para garantir que os canvas estejam no DOM
  requestAnimationFrame(() => renderizarGraficos(av, "inline"));
}

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

  txt += `Os escores brutos foram comparados às normas do NEUPSILIN Adulto estratificadas por faixa etária (${getFaixaEtaria(av.paciente.idade)} anos) e escolaridade.`;
  return txt;
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
  doc.text("NEUPSILIN ADULTO", L, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Instrumento de Avalição Neuropsicológica Breve — Versão Adulto", L, 20);
  doc.text("LAUDO DE CORREÇÃO AUTOMÁTICA", L, 26);

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
