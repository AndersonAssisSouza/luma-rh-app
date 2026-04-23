/**
 * Cloudflare Worker — Luma Plataforma · RH Subdomain
 * Rota: lumarh.lumaplataforma.com.br/*  →  Azure Static Web Apps
 *
 * Diferença do gestaorh-worker: sem strip de prefixo de path.
 * Os arquivos são servidos na raiz do subdomínio, sem /gestaorh/ prefix.
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → lumarh-worker
 * Rota:   lumarh.lumaplataforma.com.br/*
 */

const AZURE_ORIGIN = 'https://ashy-plant-05558780f.2.azurestaticapps.net';

// Headers sensíveis do cliente que NÃO devem ser repassados ao Azure
const BLOCKED_REQUEST_HEADERS = new Set([
  'cookie', 'authorization', 'cf-connecting-ip', 'cf-ipcountry',
  'cf-ray', 'cf-visitor', 'x-forwarded-for', 'x-real-ip',
  'true-client-ip', 'x-forwarded-host',
]);

// Headers internos da resposta Azure que não devem ser expostos ao cliente
const BLOCKED_RESPONSE_HEADERS = new Set([
  'x-powered-by', 'server', 'x-ms-request-id',
  'x-ms-version', 'x-azure-ref',
]);

export default {
  async fetch(request) {
    // Somente GET e HEAD — esta rota serve apenas arquivos estáticos
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url  = new URL(request.url);
    let   path = url.pathname;
    const qs   = url.search;

    // Prevenir path traversal: rejeitar qualquer segmento com '..'
    if (/(?:^|\/)\.\.(?:\/|$)/.test(path) || path.includes('%2e%2e') || path.includes('%2E%2E')) {
      return new Response('Bad Request', { status: 400 });
    }

    // Raiz → redirecionar para login
    if (path === '/' || path === '') {
      return Response.redirect('https://lumarh.lumaplataforma.com.br/login.html', 301);
    }

    // Permitir apenas extensões de arquivos estáticos conhecidos ou caminhos simples
    if (!/^\/[a-zA-Z0-9._\-/]*$/.test(path)) {
      return new Response('Bad Request', { status: 400 });
    }

    // Repassa ao Azure sem alteração de path (arquivos na raiz do Azure SWA)
    const target = AZURE_ORIGIN + path + qs;

    // Filtrar headers da requisição — não repassa cookies nem auth ao Azure
    const cleanHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
        cleanHeaders.set(key, value);
      }
    }

    // Desabilita cache do Worker para o Azure — sempre busca versão atual
    const response = await fetch(new Request(target, {
      method:  request.method,
      headers: cleanHeaders,
      cf: { cacheEverything: false },
    }));

    // Filtrar headers da resposta — não expõe detalhes internos do Azure
    const cleanRespHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        cleanRespHeaders.set(key, value);
      }
    }

    // Força no-cache para HTML e JS — impede Cloudflare e browser de cachear
    if (path.endsWith('.html') || path.endsWith('.js')) {
      cleanRespHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      cleanRespHeaders.set('Pragma', 'no-cache');
    }

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    cleanRespHeaders,
    });
  },
};
