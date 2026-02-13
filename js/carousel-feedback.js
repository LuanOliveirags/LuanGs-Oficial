// carousel-feedback.js - carrossel de feedbacks

export function initCarouselFeedback() {
  // Lógica do carrossel de feedbacks
}
// ====================================================
// carousel-feedback.js - Carrossel de feedbacks de alunas
// Objetivo: Exibir prints de feedbacks em carrossel interativo com barra de progresso e modal
//
// Etapa 3: Scripts e interações
// - Cada função está comentada para facilitar manutenção
// - Não altere a lógica sem necessidade
//
// Principais funções:
//   3.1 Inicialização do carrossel
//   3.2 Renderização dos cards
//   3.3 Barra de progresso e dots
//   3.4 Modal de imagem ampliada
//   3.5 Auto-slide e navegação
// ====================================================
const feedbackPrints = [
  'img/screenshot_1.png',
  'img/screenshot_2.png',
  'img/screenshot_3.png',
  'img/screenshot_4.png',
];

document.addEventListener('DOMContentLoaded', initFeedbackGallery);

function initFeedbackGallery() {
  const deck = document.getElementById('feedbackDeck');
  const prevBtn = document.getElementById('feedbackPrev');
  const nextBtn = document.getElementById('feedbackNext');
  const modal = document.getElementById('feedback-modal');
  const modalImg = document.getElementById('feedback-modal-img');
  const modalClose = document.getElementById('feedback-modal-close');

  if (!deck || !prevBtn || !nextBtn) return;

  // Criar barra de progresso
  const progressContainer = document.createElement('div');
  progressContainer.className = 'feedback-progress-container';
  progressContainer.innerHTML = `
    <div class="feedback-progress-bar">
      <div class="feedback-progress-fill" id="feedbackProgressFill"></div>
    </div>
    <div class="feedback-progress-dots" id="feedbackProgressDots"></div>
  `;
  document.querySelector('.portfolio-feedbacks-section .container').appendChild(progressContainer);

  const progressFill = document.getElementById('feedbackProgressFill');
  const progressDots = document.getElementById('feedbackProgressDots');

  // Criar dots de progresso
  feedbackPrints.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'feedback-progress-dot';
    if (index === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToIndex(index));
    progressDots.appendChild(dot);
  });

  let currentIndex = 0;
  let autoSlide = null;

  const total = feedbackPrints.length;

  const normalize = (index) => (index + total) % total;

  const createCardMarkup = (src, altText) => {
    const article = document.createElement('article');
    article.className = 'feedback-card active';
    article.innerHTML = `
      <div class="feedback-card__image">
        <img src="${src}" alt="${altText}" loading="lazy">
      </div>
    `;
    return article;
  };

  const renderDeck = () => {
    // Fade out
    deck.style.opacity = '0';
    
    setTimeout(() => {
      deck.innerHTML = '';
      const card = createCardMarkup(
        feedbackPrints[currentIndex],
        `Print de feedback ${currentIndex + 1}`
      );
      deck.appendChild(card);
      
      // Atualizar barra de progresso
      updateProgress();
      
      // Fade in
      setTimeout(() => {
        deck.style.opacity = '1';
      }, 50);
    }, 300);
  };

  const updateProgress = () => {
    const percentage = ((currentIndex + 1) / total) * 100;
    if (progressFill) progressFill.style.width = percentage + '%';
    
    // Atualizar dots
    const dots = progressDots.querySelectorAll('.feedback-progress-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
  };

  const goToIndex = (index) => {
    currentIndex = normalize(index);
    renderDeck();
    restartAutoSlide();
  };

  const showPrev = () => goToIndex(currentIndex - 1);
  const showNext = () => goToIndex(currentIndex + 1);

  const restartAutoSlide = () => {
    if (autoSlide) clearInterval(autoSlide);
    autoSlide = setInterval(showNext, 4000);
  };

  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);

  deck.addEventListener('click', (event) => {
    const img = event.target.closest('.feedback-card__image img');
    if (!img) return;
    openFeedbackModal(img.getAttribute('src'));
  });

  const openFeedbackModal = (src) => {
    if (!modal || !modalImg) return;
    modalImg.src = src;
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });
  };

  const closeModal = () => {
    if (!modal) return;
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      if (modalImg) modalImg.src = '';
    }, 250);
  };

  if (modal && modalClose) {
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
  }

  // Inicialização
  deck.style.transition = 'opacity 0.3s ease';
  renderDeck();
  restartAutoSlide();
}

