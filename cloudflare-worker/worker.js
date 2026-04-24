/**
 * Cloudflare Worker — Luma Plataforma (genérico)
 *
 * NOTA: Este worker não é mais necessário.
 * O sistema agora está hospedado no Cloudflare Pages com domínio personalizado.
 *
 * Mantido apenas como referência. Pode ser removido do Cloudflare Dashboard.
 */

export default {
  async fetch(request) {
    return Response.redirect('https://lumarh.lumaplataforma.com.br/login.html', 301);
  },
};
