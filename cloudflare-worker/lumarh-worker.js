/**
 * Cloudflare Worker — Luma Plataforma · RH Subdomain
 * Rota: lumarh.lumaplataforma.com.br/*
 *
 * NOTA: Este worker não é mais necessário.
 * O sistema agora está hospedado no Cloudflare Pages com domínio personalizado
 * configurado diretamente nas configurações do projeto Pages.
 *
 * Mantido apenas como referência. Pode ser removido do Cloudflare Dashboard.
 */

export default {
  async fetch(request) {
    // Redireciona para o Cloudflare Pages diretamente
    const url = new URL(request.url);
    return Response.redirect('https://lumarh.lumaplataforma.com.br' + url.pathname + url.search, 301);
  },
};
