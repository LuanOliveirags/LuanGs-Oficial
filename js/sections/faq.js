// faq.js — FAQ accordion (animação via CSS grid-template-rows)

export function initFaq() {
  const faqCards = document.querySelectorAll('[data-faq]');

  faqCards.forEach(card => {
    const question = card.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isActive = card.classList.contains('active');

      // Fecha todos os outros
      faqCards.forEach(other => {
        if (other !== card) other.classList.remove('active');
      });

      // Toggle do clicado
      card.classList.toggle('active', !isActive);
    });
  });
}
