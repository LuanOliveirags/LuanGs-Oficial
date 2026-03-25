document.addEventListener('DOMContentLoaded', function() {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registrado');
                // Pedir permissão para notificações
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Notificações permitidas');
                        }
                    });
                }
            })
            .catch(error => console.log('Erro no SW:', error));
    }
    
    const form = document.getElementById('form-transacao');
    const saldoSpan = document.getElementById('saldo-atual');
    const totalReceitasSpan = document.getElementById('total-receitas');
    const totalDespesasSpan = document.getElementById('total-despesas');
    const formDivida = document.getElementById('form-divida');
    const listaDividasLuan = document.getElementById('lista-dividas-luan');
    const listaDividasBianca = document.getElementById('lista-dividas-bianca');
    const listaDividasConjunto = document.getElementById('lista-dividas-conjunto');
    const formSalario = document.getElementById('form-salario');
    const toggleTema = document.querySelector('.btn-tema');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const btnExportar = document.getElementById('btn-exportar');
    const btnImportar = document.getElementById('btn-importar');
    const inputImportar = document.getElementById('importar-excel');
    const btnTestarNotificacao = document.getElementById('btn-testar-notificacao');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const fab = document.getElementById('fab-adicionar');
    const navItems = document.querySelectorAll('.nav-item');

    let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    let transacoesFiltradas = [...transacoes];
    let dividas = JSON.parse(localStorage.getItem('dividas')) || [];
    let salarios = JSON.parse(localStorage.getItem('salarios')) || { luan: { bruto: 0, descontos: 0 }, bianca: { bruto: 0, descontos: 0 } };
    let temaEscuro = localStorage.getItem('tema') === 'dark';

    // Tema
    function aplicarTema() {
        document.body.classList.toggle('dark', temaEscuro);
        if (toggleTema) {
            toggleTema.innerHTML = temaEscuro ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }

    if (toggleTema) {
        toggleTema.addEventListener('click', function() {
            temaEscuro = !temaEscuro;
            localStorage.setItem('tema', temaEscuro ? 'dark' : 'light');
            aplicarTema();
        });
    }

    aplicarTema();

    // Navegação por abas
    function showSection(sectionId) {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => section.classList.remove('active'));
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        navItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

        window.scrollTo(0, 0);
    }

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            showSection(this.dataset.section);
        });
    });

    if (fab) {
        fab.addEventListener('click', function() {
            showSection('formulario');
        });
    }

    // Cálculos
    function calcularTotais() {
        const receitas = transacoesFiltradas.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoesFiltradas.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        const saldo = receitas - despesas;

        const meses = [...new Set(transacoesFiltradas.map(t => t.data.substring(0, 7)))];
        const media = meses.length > 0 ? saldo / meses.length : 0;

        const dividasLuan = dividas.filter(d => d.responsavel === 'luan').reduce((sum, d) => sum + d.valor, 0);
        const dividasBianca = dividas.filter(d => d.responsavel === 'bianca').reduce((sum, d) => sum + d.valor, 0);
        const dividasConjunto = dividas.filter(d => d.responsavel === 'conjunto').reduce((sum, d) => sum + d.valor, 0);

        const salarioLuanLiquido = salarios.luan.bruto - salarios.luan.descontos;
        const salarioBiancaLiquido = salarios.bianca.bruto - salarios.bianca.descontos;
        const salarioConjuntoLiquido = salarioLuanLiquido + salarioBiancaLiquido;

        totalReceitasSpan.textContent = `R$ ${receitas.toFixed(2)}`;
        totalDespesasSpan.textContent = `R$ ${despesas.toFixed(2)}`;
        saldoSpan.textContent = `R$ ${saldo.toFixed(2)}`;
        mediaMensalSpan.textContent = `R$ ${media.toFixed(2)}`;
        totalDividasLuanSpan.textContent = `R$ ${dividasLuan.toFixed(2)}`;
        totalDividasBiancaSpan.textContent = `R$ ${dividasBianca.toFixed(2)}`;
        totalDividasConjuntoSpan.textContent = `R$ ${dividasConjunto.toFixed(2)}`;
        salarioLiquidoSpan.textContent = `R$ ${salarioConjuntoLiquido.toFixed(2)}`;
    }

    // Gráfico
    let chart, chartDividas;
    function atualizarGrafico() {
        const receitas = transacoesFiltradas.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoesFiltradas.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);

        if (chart) chart.destroy();

        chart = new Chart(document.getElementById('grafico'), {
            type: 'doughnut',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{
                    data: [receitas, despesas],
                    backgroundColor: ['#4CAF50', '#f44336']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });

        // Gráfico de dívidas
        const dividasLuan = dividas.filter(d => d.responsavel === 'luan').reduce((sum, d) => sum + d.valor, 0);
        const dividasBianca = dividas.filter(d => d.responsavel === 'bianca').reduce((sum, d) => sum + d.valor, 0);
        const dividasConjunto = dividas.filter(d => d.responsavel === 'conjunto').reduce((sum, d) => sum + d.valor, 0);

        if (chartDividas) chartDividas.destroy();

        chartDividas = new Chart(document.getElementById('grafico-dividas'), {
            type: 'bar',
            data: {
                labels: ['Luan', 'Bianca', 'Conjunto'],
                datasets: [{
                    label: 'Dívidas (R$)',
                    data: [dividasLuan, dividasBianca, dividasConjunto],
                    backgroundColor: ['#FF9800', '#E91E63', '#009688']
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Exibir transações
    function exibirTransacoes() {
        lista.innerHTML = '';
        transacoesFiltradas.forEach((transacao, index) => {
            const li = document.createElement('li');
            li.className = transacao.tipo;
            li.innerHTML = `
                <span>${transacao.descricao} - R$ ${transacao.valor.toFixed(2)} (${transacao.data}) - ${transacao.categoria}</span>
                <button onclick="removerTransacao(${transacao.id})">Remover</button>
            `;
            lista.appendChild(li);
        });
    }

    // Exibir dívidas
    function exibirDividas() {
        listaDividasLuan.innerHTML = '';
        listaDividasBianca.innerHTML = '';
        listaDividasConjunto.innerHTML = '';

        dividas.forEach(divida => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${divida.nome} - Parcela: ${divida.parcela} - Venc: ${divida.diaVencimento} - R$ ${divida.valor.toFixed(2)}</span>
                <button onclick="removerDivida(${divida.id})">Remover</button>
            `;

            if (divida.responsavel === 'luan') listaDividasLuan.appendChild(li);
            else if (divida.responsavel === 'bianca') listaDividasBianca.appendChild(li);
            else listaDividasConjunto.appendChild(li);
        });
    }

    // Exibir salários
    function exibirSalarios() {
        document.getElementById('salario-luan-bruto').textContent = salarios.luan.bruto.toFixed(2);
        document.getElementById('salario-luan-descontos').textContent = salarios.luan.descontos.toFixed(2);
        document.getElementById('salario-luan-liquido').textContent = (salarios.luan.bruto - salarios.luan.descontos).toFixed(2);

        document.getElementById('salario-bianca-bruto').textContent = salarios.bianca.bruto.toFixed(2);
        document.getElementById('salario-bianca-descontos').textContent = salarios.bianca.descontos.toFixed(2);
        document.getElementById('salario-bianca-liquido').textContent = (salarios.bianca.bruto - salarios.bianca.descontos).toFixed(2);

        document.getElementById('salario-conjunto-bruto').textContent = (salarios.luan.bruto + salarios.bianca.bruto).toFixed(2);
        document.getElementById('salario-conjunto-descontos').textContent = (salarios.luan.descontos + salarios.bianca.descontos).toFixed(2);
        document.getElementById('salario-conjunto-liquido').textContent = ((salarios.luan.bruto - salarios.luan.descontos) + (salarios.bianca.bruto - salarios.bianca.descontos)).toFixed(2);
    }

    // Salvar
    function salvarTransacoes() {
        localStorage.setItem('transacoes', JSON.stringify(transacoes));
    }

    function salvarDividas() {
        localStorage.setItem('dividas', JSON.stringify(dividas));
    }

    function salvarSalarios() {
        localStorage.setItem('salarios', JSON.stringify(salarios));
    }

    // Remover
    window.removerTransacao = function(id) {
        transacoes = transacoes.filter(t => t.id !== id);
        aplicarFiltros();
        salvarTransacoes();
    };

    // Adicionar
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const tipo = document.getElementById('tipo').value;
        const categoria = document.getElementById('categoria').value;
        const descricao = document.getElementById('descricao').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const data = document.getElementById('data').value;

        const transacao = { id: Date.now(), tipo, categoria, descricao, valor, data };
        transacoes.push(transacao);
        aplicarFiltros();
        salvarTransacoes();
        form.reset();
        // Confete para receita
        if (tipo === 'receita') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    });

    // Adicionar dívida
    formDivida.addEventListener('submit', function(e) {
        e.preventDefault();
        const responsavel = document.getElementById('responsavel').value;
        const nome = document.getElementById('nome-divida').value;
        const parcela = document.getElementById('parcela').value;
        const diaVencimento = parseInt(document.getElementById('dia-vencimento').value);
        const valor = parseFloat(document.getElementById('valor-divida').value);

        const divida = { id: Date.now(), responsavel, nome, parcela, diaVencimento, valor };
        dividas.push(divida);
        exibirDividas();
        calcularTotais();
        salvarDividas();
        formDivida.reset();
    });

    // Adicionar salário
    formSalario.addEventListener('submit', function(e) {
        e.preventDefault();
        const pessoa = document.getElementById('pessoa-salario').value;
        const bruto = parseFloat(document.getElementById('salario-bruto').value);
        const descontos = parseFloat(document.getElementById('descontos').value);

        salarios[pessoa] = { bruto, descontos };
        exibirSalarios();
        calcularTotais();
        salvarSalarios();
        formSalario.reset();
    });

    // Testar notificação
    btnTestarNotificacao.addEventListener('click', function() {
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.controller.postMessage({
                type: 'NOTIFY',
                message: 'Teste de notificação! Funcionando perfeitamente.'
            });
        } else {
            alert('Notificações não permitidas. Permita no navegador para receber lembretes.');
        }
    });

    // Filtros
    function aplicarFiltros() {
        let filtradas = [...transacoes];

        if (filtroMes.value) {
            filtradas = filtradas.filter(t => t.data.startsWith(filtroMes.value));
        }

        if (filtroCategoria.value) {
            filtradas = filtradas.filter(t => t.categoria === filtroCategoria.value);
        }

        transacoesFiltradas = filtradas;
        exibirTransacoes();
        calcularTotais();
        atualizarGrafico();
    }

    btnFiltrar.addEventListener('click', aplicarFiltros);
    btnLimparFiltros.addEventListener('click', function() {
        filtroMes.value = '';
        filtroCategoria.value = '';
        aplicarFiltros();
    });

    // Exportar CSV
    btnExportar.addEventListener('click', function() {
        const csv = transacoesFiltradas.map(t => `${t.data},${t.tipo},${t.categoria},${t.descricao},${t.valor}`).join('\n');
        const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
        const blob = new Blob([header + csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transacoes.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    // Importar Excel
    btnImportar.addEventListener('click', function() {
        const file = inputImportar.files[0];
        if (!file) {
            alert('Selecione um arquivo Excel primeiro.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Assumir que a primeira linha é cabeçalho
            const headers = json[0];
            const rows = json.slice(1);

            // Mapear colunas (flexível)
            const colMap = {};
            headers.forEach((h, i) => {
                const lower = h.toLowerCase();
                if (lower.includes('data')) colMap.data = i;
                else if (lower.includes('tipo') || lower.includes('type')) colMap.tipo = i;
                else if (lower.includes('categoria') || lower.includes('category')) colMap.categoria = i;
                else if (lower.includes('descrição') || lower.includes('description') || lower.includes('desc')) colMap.descricao = i;
                else if (lower.includes('valor') || lower.includes('value') || lower.includes('amount')) colMap.valor = i;
            });

            rows.forEach(row => {
                const data = row[colMap.data];
                const tipo = row[colMap.tipo] ? row[colMap.tipo].toLowerCase().includes('receita') ? 'receita' : 'despesa' : 'despesa';
                const categoria = row[colMap.categoria] || 'outros';
                const descricao = row[colMap.descricao] || 'Importado';
                const valor = parseFloat(row[colMap.valor]) || 0;

                if (data && valor) {
                    const transacao = { id: Date.now() + Math.random(), tipo, categoria, descricao, valor, data: new Date(data).toISOString().split('T')[0] };
                    transacoes.push(transacao);
                }
            });

            salvarTransacoes();
            aplicarFiltros();
            alert('Dados importados com sucesso!');
        };
        reader.readAsArrayBuffer(file);
    });

    // Inicializar com dados de exemplo se vazio
    if (dividas.length === 0) {
        dividas = [
            { id: 1, responsavel: 'luan', nome: 'Financiamento Corsa', parcela: '4/36', diaVencimento: 3, valor: 1350 },
            { id: 2, responsavel: 'luan', nome: 'Habitação Caixa', parcela: 'FIXO', diaVencimento: 20, valor: 980 },
            { id: 3, responsavel: 'conjunto', nome: 'Condo/Agua/Gás', parcela: 'FIXO', diaVencimento: 10, valor: 620 },
            { id: 4, responsavel: 'luan', nome: 'Cartão Porto Seguro', parcela: 'FIXO', diaVencimento: 20, valor: 100 },
            { id: 5, responsavel: 'luan', nome: 'Recrearte', parcela: 'FIXO', diaVencimento: 20, valor: 660 },
            { id: 6, responsavel: 'luan', nome: 'Luz', parcela: 'FIXO', diaVencimento: 15, valor: 290 },
            { id: 7, responsavel: 'luan', nome: 'Perua', parcela: 'FIXO', diaVencimento: 20, valor: 380 },
            { id: 8, responsavel: 'luan', nome: 'Claro', parcela: 'FIXO', diaVencimento: 20, valor: 60 },
            { id: 9, responsavel: 'luan', nome: 'Claro Residencial', parcela: 'FIXO', diaVencimento: 15, valor: 130 },
            { id: 10, responsavel: 'luan', nome: 'Total pass', parcela: 'FIXO', diaVencimento: 0, valor: 239.80 },
            { id: 11, responsavel: 'bianca', nome: 'Claro', parcela: 'FIXO', diaVencimento: 20, valor: 87 }
        ];
        salvarDividas();
    }

    if (salarios.luan.bruto === 0) {
        salarios.luan = { bruto: 2600, descontos: 0 };
        salarios.bianca = { bruto: 2500, descontos: 0 };
        salvarSalarios();
    }

    // Notificações de vencimento
    function verificarVencimentos() {
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);

        dividas.forEach(divida => {
            const vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), divida.diaVencimento);
            if (vencimento < hoje) {
                vencimento.setMonth(vencimento.getMonth() + 1); // Próximo mês
            }

            if (vencimento.toDateString() === amanha.toDateString()) {
                if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'NOTIFY',
                        message: `Dívida ${divida.nome} vence amanhã! Valor: R$ ${divida.valor.toFixed(2)}`
                    });
                } else {
                    alert(`Lembrete: Dívida ${divida.nome} vence amanhã!`);
                }
            }
        });
    }

    // Verificar a cada hora (simulação)
    setInterval(verificarVencimentos, 3600000); // 1 hora
    verificarVencimentos(); // Ao carregar

    aplicarFiltros();
    exibirDividas();
    exibirSalarios();
});