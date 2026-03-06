// carousel-feedback.js - carrossel de feedbacks

export function initCarouselFeedback() {
  // stub para compatibilidade com import
}

// ====================================================
// carousel-feedback.js - Carrossel de feedbacks
//
// Funcionalidades:
//   Desktop: 3 fotos simultâneas, card central em destaque
//   Mobile:  1 foto por vez, navegação por swipe
//   Modal:   imagem expandida com swipe e botão fechar
// ====================================================

const feedbackPrints = [
  'img/Screenshot_1.png',
  'img/Screenshot_2.png',
  'img/Screenshot_3.png',
];

document.addEventListener('DOMContentLoaded', initFeedbackGallery);

function initFeedbackGallery() {
  const deck     = document.getElementById('feedbackDeck');
  const prevBtn  = document.getElementById('feedbackPrev');
  const nextBtn  = document.getElementById('feedbackNext');
  const modal    = document.getElementById('feedback-modal');
  const modalImg = document.getElementById('feedback-modal-img');
  const modalClose = document.getElementById('feedback-modal-close');

  if (!deck || !prevBtn || !nextBtn) return;

  // ── Barra de progresso ──────────────────────────────
  const progressContainer = document.createElement('div');
  progressContainer.className = 'feedback-progress-container';
  progressContainer.innerHTML = `
    <div class="feedback-progress-bar">
      <div class="feedback-progress-fill" id="feedbackProgressFill"></div>
    </div>
    <div class="feedback-progress-dots" id="feedbackProgressDots"></div>
  `;
  document.querySelector('.portfolio-feedbacks-section .container')
    .appendChild(progressContainer);

  const progressFill = document.getElementById('feedbackProgressFill');
  const progressDots = document.getElementById('feedbackProgressDots');

  feedbackPrints.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'feedback-progress-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToIndex(i));
    progressDots.appendChild(dot);
  });

  // ── Estado ──────────────────────────────────────────
  let currentIndex = 0;
  let modalIndex   = 0;
  let autoSlide    = null;

  const total     = feedbackPrints.length;
  const normalize = (i) => (i + total) % total;
  const isMobile  = () => window.matchMedia('(max-width: 768px)').matches;

  // ── Criação de card ─────────────────────────────────
  const createCard = (index, role) => {
    const article = document.createElement('article');
    article.className   = `feedback-card ${role}`;
    article.dataset.role  = role;
    article.dataset.index = String(index);
    article.innerHTML = `
      <div class="feedback-card__image">
        <img src="${feedbackPrints[index]}"
             alt="Print de feedback ${index + 1}"
             loading="lazy">
      </div>
    `;
    return article;
  };

  // ── Renderização ────────────────────────────────────
  const renderDeck = () => {
    deck.style.opacity = '0';
    setTimeout(() => {
      deck.innerHTML = '';
      if (isMobile()) {
        deck.appendChild(createCard(currentIndex, 'active'));
      } else {
        deck.appendChild(createCard(normalize(currentIndex - 1), 'prev'));
        deck.appendChild(createCard(currentIndex, 'active'));
        deck.appendChild(createCard(normalize(currentIndex + 1), 'next'));
      }
      updateProgress();
      setTimeout(() => { deck.style.opacity = '1'; }, 30);
    }, 280);
  };

  const updateProgress = () => {
    const pct = ((currentIndex + 1) / total) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    progressDots.querySelectorAll('.feedback-progress-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentIndex);
    });
  };

  // ── Navegação ───────────────────────────────────────
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

  // ── Clique no deck ──────────────────────────────────
  deck.addEventListener('click', (e) => {
    const card = e.target.closest('.feedback-card');
    if (!card) return;
    const role = card.dataset.role;
    if (!isMobile()) {
      if (role === 'prev') { showPrev(); return; }
      if (role === 'next') { showNext(); return; }
    }
    if (role === 'active') openModal(currentIndex);
  });

  // ── Swipe no deck ───────────────────────────────────
  let tStartX = 0, tStartY = 0;

  deck.addEventListener('touchstart', (e) => {
    tStartX = e.touches[0].clientX;
    tStartY = e.touches[0].clientY;
  }, { passive: true });

  deck.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tStartX;
    const dy = e.changedTouches[0].clientY - tStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? showNext() : showPrev();
    }
  }, { passive: true });

  // ── Modal ───────────────────────────────────────────
  const openModal = (index) => {
    if (!modal || !modalImg) return;
    modalIndex = normalize(index);
    modalImg.src = feedbackPrints[modalIndex];
    modal.classList.add('is-open');
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => { if (modalImg) modalImg.src = ''; }, 300);
  };

  const navigateModal = (direction) => {
    modalIndex = normalize(modalIndex + direction);
    modalImg.style.opacity = '0';
    setTimeout(() => {
      modalImg.src = feedbackPrints[modalIndex];
      modalImg.style.opacity = '1';
    }, 200);
  };

  if (modal && modalClose) {
    modalImg.style.transition = 'opacity 0.2s ease';

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape')      closeModal();
      if (e.key === 'ArrowLeft')   navigateModal(-1);
      if (e.key === 'ArrowRight')  navigateModal(1);
    });

    // Swipe no modal
    let mStartX = 0, mStartY = 0;
    modal.addEventListener('touchstart', (e) => {
      mStartX = e.touches[0].clientX;
      mStartY = e.touches[0].clientY;
    }, { passive: true });
    modal.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - mStartX;
      const dy = e.changedTouches[0].clientY - mStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        navigateModal(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  // ── Re-render ao redimensionar ──────────────────────
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderDeck, 200);
  });

  // ── Init ────────────────────────────────────────────
  deck.style.transition = 'opacity 0.3s ease';
  renderDeck();
  restartAutoSlide();
}

