// Destaca o menu conforme a seção visível na tela
// Foca em destacar 'Como funciona' ao rolar para a seção correspondente

document.addEventListener('DOMContentLoaded', function () {
  const navLinks = document.querySelectorAll('.nav-menu a');
  const sections = [
    { id: 'inicio', link: null },
    { id: 'sobre', link: null },
    { id: 'como-funciona', link: null },
    { id: 'planos', link: null },
    { id: 'resultados', link: null }
  ];

  // Associa cada link à sua seção
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      const id = href.replace('#', '');
      const section = sections.find(s => s.id === id);
      if (section) section.link = link;
    }
  });

  function onScroll() {
    let currentSection = sections[0];
    const scrollY = window.scrollY + 120; // Compensa header fixo
    for (let i = 0; i < sections.length; i++) {
      const sectionEl = document.getElementById(sections[i].id);
      if (sectionEl && sectionEl.offsetTop <= scrollY) {
        currentSection = sections[i];
      }
    }
    navLinks.forEach(link => link.classList.remove('active'));
    if (currentSection.link) currentSection.link.classList.add('active');
  }

  window.addEventListener('scroll', onScroll);
  onScroll(); // Executa ao carregar
});
