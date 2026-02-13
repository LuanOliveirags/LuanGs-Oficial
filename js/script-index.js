// ====================================================
// script-index.js - Scripts principais do site
// Objetivo: Controlar menu mobile, modais de imagem, FAQ, animações e interações gerais
//
// Etapa 3: Scripts e interações
// - Cada função está comentada para facilitar manutenção
// - Não altere a lógica sem necessidade
//
// Principais funções:
//   3.1 Menu mobile
//   3.2 Modal de imagens dos resultados
//   3.3 FAQ accordion
//   3.4 Preloader
//   3.5 Scroll suave
//   3.6 Animações de estatísticas e scroll
// ====================================================
// ===== INICIALIZAÇÃO GERAL =====
document.addEventListener('DOMContentLoaded', function() {
  initMenuMobile();
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

// ===== MENU MOBILE =====
function initMenuMobile() {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (menuToggle && navMenu && menuOverlay) {
    // Toggle do menu com o hamburguer
    menuToggle.addEventListener('click', function() {
      const isOpen = navMenu.classList.contains('open');
      
      if (isOpen) {
        navMenu.classList.remove('open');
        menuToggle.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
      } else {
        navMenu.classList.add('open');
        menuToggle.classList.add('active');
        menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
    
    // Fecha o menu ao clicar no overlay
    menuOverlay.addEventListener('click', function() {
      navMenu.classList.remove('open');
      menuToggle.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
    
    // Fecha o menu ao clicar em um link
    const menuLinks = navMenu.querySelectorAll('.menu-items a');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        menuToggle.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }
}

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

// ===== FAQ ACCORDION =====
function initFAQ() {
  const faqCards = document.querySelectorAll('[data-faq]');
  
  faqCards.forEach(card => {
    const question = card.querySelector('.faq-question');
    const answer = card.querySelector('.faq-answer');
    
    if (!question || !answer) return;
    
    question.addEventListener('click', () => {
      const isActive = card.classList.contains('active');
      
      // Fecha todos os outros cards
      faqCards.forEach(otherCard => {
        if (otherCard !== card) {
          otherCard.classList.remove('active');
          const otherAnswer = otherCard.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.display = 'none';
        }
      });
      
      // Toggle do card clicado
      if (isActive) {
        card.classList.remove('active');
        answer.style.display = 'none';
      } else {
        card.classList.add('active');
        answer.style.display = 'block';
      }
    });
  });
}
// ===== PRELOADER =====
window.addEventListener('load', function() {
  const loader = document.getElementById('preloader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 500);
    }, 1500);
  }
});

// ===== SMOOTH SCROLL PARA LINKS INTERNOS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const headerHeight = document.querySelector('.header').offsetHeight;
      const targetPosition = target.offsetTop - headerHeight;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// ===== CONTADOR ANIMADO DE ESTATÍSTICAS =====
function animateCounter(element, target, duration = 2000) {
  let start = 0;
  const increment = target / (duration / 16);
  
  function updateCounter() {
    start += increment;
    if (start < target) {
      element.textContent = Math.floor(start);
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
    }
  }
  
  updateCounter();
}

// Observador para iniciar animação quando a seção estiver visível
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const statNumbers = entry.target.querySelectorAll('.stat-number');
      statNumbers.forEach(number => {
        const target = parseInt(number.getAttribute('data-target'));
        animateCounter(number, target);
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats-section');
if (statsSection) {
  statsObserver.observe(statsSection);
}

// ===== ANIMAÇÃO DE SCROLL REVEAL =====
const revealElements = document.querySelectorAll('.hero-content, .about-content, .process-card, .skill-card-modern, .portfolio-item');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, index * 100);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealElements.forEach(element => {
  element.style.opacity = '0';
  element.style.transform = 'translateY(30px)';
  element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  revealObserver.observe(element);
});

// ===== SCROLL HEADER EFFECT =====
let lastScroll = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  const scrolled = window.pageYOffset;
  
  // Efeito no header
  if (currentScroll <= 0) {
    header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
  } else {
    header.style.boxShadow = '0 2px 30px rgba(0, 0, 0, 0.5)';
  }
  
  // Efeito parallax no hero
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
    heroContent.style.opacity = 1 - (scrolled / 600);
  }
  
  lastScroll = currentScroll;
});


console.log('%c💡 Quer um site assim? Entre em contato!', 'color: #a0a0a0; font-size: 14px;');
