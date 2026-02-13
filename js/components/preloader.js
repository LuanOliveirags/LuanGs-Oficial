// preloader.js - controle do preloader

export function initPreloader() {
  // Lógica do preloader
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