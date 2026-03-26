/**
 * Cloudflare Worker — Luma Plataforma · Gestão RH
 * Rota: lumaplataforma.com.br/gestaorh*  →  Azure Static Web Apps
 *
 * Deploy: Cloudflare Dashboard → Workers & Pages → Create Worker → cole este código
 * Rota:   lumaplataforma.com.br/gestaorh*  (configurar em "Triggers" do Worker)
 */

const AZURE_ORIGIN = 'https://ashy-plant-05558780f.2.azurestaticapps.net';
const PATH_PREFIX  = '/gestaorh';

export default {
  async fetch(request) {
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

    const target = AZURE_ORIGIN + path + url.search;

    const response = await fetch(new Request(target, {
      method:  request.method,
      headers: request.headers,
      body:    request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    }));

    // Repassar resposta preservando headers
    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    response.headers,
    });
  },
};
