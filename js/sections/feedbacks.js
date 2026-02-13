// feedbacks.js - lógica da seção Feedbacks

export function initFeedbacks() {
  // Lógica dos feedbacks
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