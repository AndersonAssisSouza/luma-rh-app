/**
 * Copia arquivos standalone (HTML/JS avulsos + assets) para dist/
 * após o build do Vite. Executado automaticamente pelo npm postbuild.
 */
import { copyFileSync, cpSync, existsSync } from 'fs'

const files = [
  // HTML avulsos (index.html já gerado pelo Vite — não listar aqui)
  'people_analytics_editor.html',
  'portal_ferias_colaborador.html',
  'login.html',
  'acesso-negado.html',
  'admin.html',
  'configuracoes.html',
  'em-construcao.html',
  'manager.html',
  'mensagens_aniversario.html',
  'reset-password.html',
  'trocar-senha.html',
  'mockup_master.html',
  // JS modules standalone
  'supabase_client.js',
  'people_analytics_editor.js',
  'portal_ferias_colaborador.js',
  'login.js',
  'acesso-negado.js',
  'admin.js',
  'configuracoes.js',
  'index.js',
  'manager.js',
  'mensagens_aniversario.js',
  'reset-password.js',
  'msal-browser.min.js',
  // Config Cloudflare Pages
  '_headers',
]

const dirs = ['assets', 'manuais']

let n = 0
for (const f of files) {
  if (existsSync(f)) { copyFileSync(f, `dist/${f}`); n++ }
}
for (const d of dirs) {
  if (existsSync(d)) { cpSync(d, `dist/${d}`, { recursive: true }); n++ }
}

console.log(`copy-standalone: ${n} item(s) copiado(s) para dist/`)
