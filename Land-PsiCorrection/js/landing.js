/* ═══════════════════════════════════════════════════════════════
   PsiCorrection Landing Page — JavaScript
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Nav scroll effect ───
  const nav = document.getElementById('nav');
  const onScroll = () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ─── Hamburger menu ───
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
  });
  // Close menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });

  // ─── Animated counter for stats ───
  const animateCounter = (el, target) => {
    const duration = 2000;
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  };

  const statCards = document.querySelectorAll('.stat-card');
  let statsAnimated = false;
  const statsObserver = new IntersectionObserver((entries) => {
    if (statsAnimated) return;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        statsAnimated = true;
        statCards.forEach(card => {
          const target = parseInt(card.dataset.count, 10);
          const numEl = card.querySelector('.stat-card__number');
          animateCounter(numEl, target);
        });
        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });
  statCards.forEach(card => statsObserver.observe(card));

  // ─── Scroll reveal for cards with [data-aos] ───
  const revealElements = document.querySelectorAll('[data-aos]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealElements.forEach((el, i) => {
    el.style.transitionDelay = `${i * 80}ms`;
    revealObserver.observe(el);
  });

  // ─── Smooth scroll for anchor links ───
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});
