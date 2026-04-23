/**
 * Cloudflare Worker — lumaplataforma.com.br (apex)
 * Serve página em branco enquanto o site principal não está construído.
 * Quando o site principal for criado, substituir este Worker.
 *
 * Rota: lumaplataforma.com.br/*
 * www.lumaplataforma.com.br/*
 */
export default {
  async fetch(request) {
    return new Response('', {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  },
};
