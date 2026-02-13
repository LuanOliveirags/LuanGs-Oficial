// init.js - inicializador geral

import { initMenu } from '../layout/menu.js';
import { initHeader } from '../layout/header.js';
import { initPreloader } from '../components/preloader.js';
import { initModalImage } from '../components/modal-image.js';
import { initCarouselFeedback } from '../components/carousel-feedback.js';
import { initFaq } from '../sections/faq.js';
import { initResultados } from '../sections/resultados.js';
import { initFeedbacks } from '../sections/feedbacks.js';

export function initApp() {
  initMenu();
  initHeader();
  initPreloader();
  initModalImage();
  initCarouselFeedback();
  initFaq();
  initResultados();
  initFeedbacks();
  // Outros inits gerais podem ser adicionados aqui
  initForWhoCardsHighlight();
  initStatsObserver();
  initRevealObserver();
  initScrollHeaderEffect();
}

// ===== DESTAQUE DINÂMICO DOS CARDS "PARA QUEM É" NO MOBILE =====
function initForWhoCardsHighlight() {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  const blocks = Array.from(document.querySelectorAll('.forwho-card, .forwho-bad-modern, .forwho-good-modern, .process-card'));
  const diffListItems = Array.from(document.querySelectorAll('.diferenciais-list li'));
  if (diffListItems.length) {
    blocks.push(...diffListItems);
  }
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

// ===== OBSERVADOR DE ESTATÍSTICAS =====
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
function initStatsObserver() {
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
}

// ===== ANIMAÇÃO DE SCROLL REVEAL =====
function initRevealObserver() {
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
}

// ===== SCROLL HEADER EFFECT =====
function initScrollHeaderEffect() {
  let lastScroll = 0;
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    const scrolled = window.pageYOffset;
    if (currentScroll <= 0) {
      header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
    } else {
      header.style.boxShadow = '0 2px 30px rgba(0, 0, 0, 0.5)';
    }
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
      heroContent.style.opacity = 1 - (scrolled / 600);
    }
    lastScroll = currentScroll;
  });
}
