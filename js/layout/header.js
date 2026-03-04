// header.js - comportamento do header

export function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  // Adiciona/remove classe .scrolled para mudar visual ao rolar
  function onScroll() {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Estado inicial
}
