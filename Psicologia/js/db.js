/* ═══════════════════════════════════════════════════════
   NEUPSILIN — Banco de Dados (localStorage + SubtleCrypto)
   Usuários são persistidos no navegador com senha em SHA-256.
═══════════════════════════════════════════════════════ */

const ADMIN_PADRAO = {
  email: "luanoliveirags@gmail.com",
  nome:  "Luan Gs",
  crp:   "",
  role:  "admin"
};
const ADMIN_SENHA_PADRAO = "Space@10";

/**
 * Gera hash SHA-256 de uma senha (retorna Promise<string hex>).
 * Usamos WebCrypto nativo — sem bibliotecas externas.
 */
async function hashSenha(senha) {
  const encoded = new TextEncoder().encode(senha);
  const buffer  = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* Banco de dados de usuários */
const DB = {
  _key: "neupsilin_usuarios",

  getAll() {
    return JSON.parse(localStorage.getItem(this._key) || "[]");
  },

  _save(lista) {
    localStorage.setItem(this._key, JSON.stringify(lista));
  },

  findByEmail(email) {
    return this.getAll().find(u => u.email === email.toLowerCase().trim()) || null;
  },

  async create({ email, senha, nome, crp = "", role = "profissional", plano = "1mes" }) {
    if (!email || !senha || !nome) throw new Error("Preencha todos os campos obrigatórios.");
    if (senha.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");

    const lista    = this.getAll();
    const emailNorm = email.toLowerCase().trim();
    if (lista.find(u => u.email === emailNorm)) throw new Error("E-mail já cadastrado.");

    const usuario = {
      email: emailNorm,
      senhaHash: await hashSenha(senha),
      nome:  nome.trim(),
      crp:   crp.trim(),
      role,
      plano,
      expiracao: calcularExpiracao(plano),
      bloqueado: false,
      criadoEm: new Date().toISOString()
    };
    lista.push(usuario);
    this._save(lista);
    return usuario;
  },

  delete(email) {
    const lista = this.getAll().filter(u => u.email !== email.toLowerCase().trim());
    this._save(lista);
  },

  async updateSenha(email, novaSenha) {
    if (novaSenha.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
    const lista = this.getAll();
    const idx   = lista.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) throw new Error("Usuário não encontrado.");
    lista[idx].senhaHash = await hashSenha(novaSenha);
    this._save(lista);
  },

  bloquear(email) {
    const lista = this.getAll();
    const idx   = lista.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return;
    lista[idx].bloqueado   = true;
    lista[idx].bloqueadoEm = new Date().toISOString();
    this._save(lista);
  },

  ativar(email, plano) {
    const lista = this.getAll();
    const idx   = lista.findIndex(u => u.email === email.toLowerCase().trim());
    if (idx === -1) return;
    lista[idx].bloqueado   = false;
    lista[idx].plano       = plano;
    lista[idx].expiracao   = calcularExpiracao(plano);
    lista[idx].ativadoEm   = new Date().toISOString();
    delete lista[idx].bloqueadoEm;
    this._save(lista);
  },

  verificarExpiracoes() {
    const lista = this.getAll();
    let changed  = false;
    const agora  = new Date();
    lista.forEach((u, i) => {
      if (u.role === "admin" || u.bloqueado || !u.expiracao) return;
      if (new Date(u.expiracao) < agora) {
        lista[i].bloqueado   = true;
        lista[i].bloqueadoEm = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) this._save(lista);
  }
};

/** Calcula a data de expiração com base no plano. Retorna null para vitalício. */
function calcularExpiracao(plano) {
  if (plano === "vitalicio") return null;
  const d = new Date();
  if (plano === "1mes")   d.setMonth(d.getMonth() + 1);
  if (plano === "3meses") d.setMonth(d.getMonth() + 3);
  return d.toISOString();
}

/** Inicializa o banco criando o admin padrão se ainda não houver nenhum usuário. */
async function inicializarDB() {
  if (DB.getAll().length === 0) {
    await DB.create({ ...ADMIN_PADRAO, senha: ADMIN_SENHA_PADRAO, plano: "vitalicio" });
  } else {
    // Migração: garante campos novos em usuários antigos
    const lista = DB.getAll();
    let changed = false;
    lista.forEach((u, i) => {
      if (u.bloqueado === undefined) { lista[i].bloqueado = false; changed = true; }
      if (!u.plano) { lista[i].plano = u.role === "admin" ? "vitalicio" : "vitalicio"; lista[i].expiracao = null; changed = true; }
    });
    if (changed) localStorage.setItem("neupsilin_usuarios", JSON.stringify(lista));
  }
}
