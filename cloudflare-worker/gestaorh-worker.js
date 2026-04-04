/**
 * Cloudflare Worker — Luma Plataforma · Gestão RH
 * Rota: lumaplataforma.com.br/gestaorh*  →  Azure Static Web Apps
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → Create Worker → cole este código
 * Rota:   lumaplataforma.com.br/gestaorh*  (configurar em "Triggers" do Worker)
 */

const AZURE_ORIGIN = 'https://ashy-plant-05558780f.2.azurestaticapps.net';
const PATH_PREFIX  = '/gestaorh';

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

    // /gestaorh  ou  /gestaorh/  → página principal
    if (path === PATH_PREFIX || path === PATH_PREFIX + '/') {
      path = '/people_analytics_editor.html';
    }
    // /gestaorh/msal-browser.min.js → /msal-browser.min.js
    else if (path.startsWith(PATH_PREFIX + '/')) {
      path = path.slice(PATH_PREFIX.length);
    }

    // Prevenir path traversal: rejeitar qualquer segmento com '..'
    if (/(?:^|\/)\.\.(?:\/|$)/.test(path) || path.includes('%2e%2e') || path.includes('%2E%2E')) {
      return new Response('Bad Request', { status: 400 });
    }

    // Permitir apenas extensões de arquivos estáticos conhecidos ou caminhos simples
    const safePath = /^\/[a-zA-Z0-9._\-/]*$/.test(path);
    if (!safePath) {
      return new Response('Bad Request', { status: 400 });
    }

    const target = AZURE_ORIGIN + path;  // search/query não é repassado

    // Filtrar headers da requisição — não repassa cookies nem auth ao Azure
    const cleanHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) {
        cleanHeaders.set(key, value);
      }
    }

    const response = await fetch(new Request(target, {
      method:  request.method,
      headers: cleanHeaders,
    }));

    // Filtrar headers da resposta — não expõe detalhes internos do Azure
    const cleanRespHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        cleanRespHeaders.set(key, value);
      }
    }

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    cleanRespHeaders,
    });
  },
};
