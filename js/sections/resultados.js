// resultados.js - lógica da seção Resultados

export function initResultados() {
  // Lógica dos resultados
}


// ===== INICIALIZAÇÃO GERAL =====
document.addEventListener('DOMContentLoaded', function() {
  initModalImagens();
  initFAQ();
  initForWhoCardsHighlight();
});
// ===== DESTAQUE DINÂMICO DOS CARDS "PARA QUEM É" NO MOBILE =====
function initForWhoCardsHighlight() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  // Seleciona todos os elementos que devem ter destaque automático
  const blocks = Array.from(document.querySelectorAll('.forwho-card, .forwho-bad-modern, .forwho-good-modern, .process-card'));
  // Adiciona também os itens da lista de diferenciais
  const diffListItems = Array.from(document.querySelectorAll('.diferenciais-list li'));
  if (diffListItems.length) {
    blocks.push(...diffListItems);
  }
  // Adiciona os itens de resultados incríveis
  const portfolioItems = Array.from(document.querySelectorAll('.portfolio-item'));
  if (portfolioItems.length) {
    blocks.push(...portfolioItems);
  }
  if (!blocks.length) return;

  function getBlockCenterDistance(block) {
    const rect = block.getBoundingClientRect();
    const blockCenter = rect.top + rect.height / 2;
    const viewportCenter = window.innerHeight / 2;
    return Math.abs(blockCenter - viewportCenter);
  }

  function highlightMostCenteredBlock() {
    let minDist = Infinity;
    let idx = 0;
    blocks.forEach((block, i) => {
      const dist = getBlockCenterDistance(block);
      if (dist < minDist) {
        minDist = dist;
        idx = i;
      }
    });
    blocks.forEach((block, i) => {
      if (i === idx) {
        block.classList.add('active-highlight');
      } else {
        block.classList.remove('active-highlight');
      }
    });
  }

  highlightMostCenteredBlock();
  window.addEventListener('scroll', highlightMostCenteredBlock);
  window.addEventListener('resize', highlightMostCenteredBlock);
}

// (Funções de menu agora estão em js/menu.js)

// ===== MODAL DE IMAGEM EM TELA CHEIA =====
function initModalImagens() {
  const modal = document.getElementById('modal-imagem');
  const imgModal = document.getElementById('imagem-modal-grande');
  const fechar = document.getElementById('fechar-modal-imagem');
  const setaEsquerda = document.getElementById('seta-esquerda-modal');
  const setaDireita = document.getElementById('seta-direita-modal');
  
  if (!modal || !imgModal || !fechar || !setaEsquerda || !setaDireita) return;

  // Coletar todas as imagens do grid de resultados
  const portfolioItems = Array.from(document.querySelectorAll('.portfolio-item'));
  const todasImagens = portfolioItems.map(item => {
    const img = item.querySelector('img');
    return img ? {src: img.src, alt: img.alt} : null;
  }).filter(Boolean);
  
  let imagemAtual = 0;

  function mostrarImagemModal(idx) {
    if (idx < 0) idx = todasImagens.length - 1;
    if (idx >= todasImagens.length) idx = 0;
    imagemAtual = idx;
    imgModal.src = todasImagens[imagemAtual].src;
    imgModal.alt = todasImagens[imagemAtual].alt;
  }

  // Clique nas imagens dos resultados
  portfolioItems.forEach((item, idx) => {
    item.style.cursor = 'zoom-in';
    item.addEventListener('click', function() {
      const img = this.querySelector('img');
      if (!img) return;
      imagemAtual = idx;
      mostrarImagemModal(imagemAtual);
      modal.style.display = 'flex';
      modal.style.opacity = '0';
      setTimeout(() => { modal.style.opacity = '1'; }, 10);
    });
  });

  function fecharModal() {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      imgModal.src = '';
    }, 300);
  }
  
  fechar.addEventListener('click', fecharModal);
  
  // Fechar ao clicar fora da imagem
  modal.addEventListener('click', function(e) {
    if (e.target === modal) fecharModal();
  });
  
  // Navegação por teclado
  document.addEventListener('keydown', function(e) {
    if (modal.style.display === 'flex') {
      if (e.key === 'Escape') {
        fecharModal();
      } else if (e.key === 'ArrowLeft') {
        mostrarImagemModal(imagemAtual - 1);
      } else if (e.key === 'ArrowRight') {
        mostrarImagemModal(imagemAtual + 1);
      }
    }
  });
  
  // Setas do modal
  setaEsquerda.addEventListener('click', function(e) {
    e.stopPropagation();
    mostrarImagemModal(imagemAtual - 1);
  });
  
  setaDireita.addEventListener('click', function(e) {
    e.stopPropagation();
    mostrarImagemModal(imagemAtual + 1);
  });

  // Suporte a gesto de deslize no modal
  let touchStartX = 0;
  let isSwiping = false;

  modal.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    isSwiping = true;
  }, { passive: true });

  modal.addEventListener('touchmove', function(e) {
    if (!isSwiping || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 60) {
      if (deltaX > 0) {
        mostrarImagemModal(imagemAtual - 1);
      } else {
        mostrarImagemModal(imagemAtual + 1);
      }
      isSwiping = false;
    }
  }, { passive: true });

  modal.addEventListener('touchend', function() {
    isSwiping = false;
  });
}