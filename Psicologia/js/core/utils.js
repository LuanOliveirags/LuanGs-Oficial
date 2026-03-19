/* ═══════════════════════════════════════════════════════
   PsiCorrection — core/utils.js
   Utilitários compartilhados entre todos os módulos.
   Sem dependências externas — carregado primeiro.
═══════════════════════════════════════════════════════ */

/**
 * Calcula a idade em anos a partir de uma data de nascimento (YYYY-MM-DD).
 * @param {string} nasc
 * @returns {number}
 */
function calcularIdade(nasc) {
  const hoje = new Date();
  const nascData = new Date(nasc);
  let idade = hoje.getFullYear() - nascData.getFullYear();
  const m = hoje.getMonth() - nascData.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascData.getDate())) idade--;
  return idade;
}

/**
 * Formata uma string ISO para data/hora legível em pt-BR.
 * @param {string} iso
 * @returns {string}  ex.: "19/03/2026 14:30"
 */
function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

/**
 * Formata uma string YYYY-MM-DD para DD/MM/YYYY.
 * @param {string} str
 * @returns {string}
 */
function formatarDataBR(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formata uma string ISO para YYYY-MM-DD (uso em nomes de arquivo).
 * @param {string} iso
 * @returns {string}
 */
function formatarDataArq(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Remove tags HTML de uma string.
 * @param {string} str
 * @returns {string}
 */
function stripHTML(str) {
  return str.replace(/<[^>]+>/g, "");
}

/**
 * Converte o nome de uma classe CSS de badge em pares de cor RGB
 * para uso no jsPDF (background e texto).
 * @param {string} badge
 * @returns {{ bg: number[], txt: number[] }}
 */
function badgeParaCor(badge) {
  const map = {
    "badge-superior":   { bg: [220, 252, 231], txt: [21, 128, 61]  },
    "badge-medio-sup":  { bg: [209, 250, 229], txt: [6,  95,  70]  },
    "badge-medio":      { bg: [219, 234, 254], txt: [29, 78,  216] },
    "badge-medio-inf":  { bg: [254, 249, 195], txt: [161, 98,  7]  },
    "badge-iinferior":  { bg: [254, 226, 226], txt: [185, 28,  28] },
    "badge-inferior":   { bg: [254, 226, 226], txt: [185, 28,  28] },
    "badge-admin":      { bg: [239, 246, 255], txt: [29,  78,  216]},
    "badge-prof":       { bg: [240, 253, 244], txt: [21, 128,  61] }
  };
  return map[badge] || { bg: [226, 232, 240], txt: [100, 116, 139] };
}
