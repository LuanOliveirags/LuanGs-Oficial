// Troca dinâmica dos vídeos na seção "Mito ou Verdade?" com play garantido ao clicar
// (robusto para mobile e navegadores restritivos)
document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('mainVideo');
  const btns = document.querySelectorAll('.video-btn');
  if (!video || !btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('active')) return;
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const src = btn.getAttribute('data-src');
      // Remove todos os sources antigos
      while (video.firstChild) video.removeChild(video.firstChild);
      // Cria novo source
      const source = document.createElement('source');
      source.setAttribute('src', src);
      source.setAttribute('type', 'video/mp4');
      video.appendChild(source);
      video.load();
      // Tenta dar play imediatamente após o load
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Se o navegador bloquear, aguarda interação do usuário
          video.addEventListener('canplay', function tryPlay() {
            video.play();
            video.removeEventListener('canplay', tryPlay);
          });
        });
      }
    });
  });
});
