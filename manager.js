import {
  sb, SUPABASE_URL, requireAuth, logout, getProfileCached,
  getTenants, criarTenant, updateTenant,
  getProfiles, updateProfile
} from './supabase_client.js'

const SB_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Y2xjZHBwaWZtbWRqenRmdW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzNjg4OCwiZXhwIjoyMDkwMTEyODg4fQ.OGYi5aNnXIyZdQbK3I7e-_GICcClzHd9G2hZZS0dx1g'

let TENANTS = []
let USERS   = []

window.doLogout = async function() { await logout() }

// ============================================================
// SEGURANÇA: escape de HTML para prevenir XSS
// Usar esc() em TODOS os dados vindos do banco antes de inserir em innerHTML
// ============================================================
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
}

// ============================================================
// INIT
// ============================================================
;(async () => {
  const profile = await requireAuth(['manager_global'])
  if (!profile) return

  document.getElementById('nav-user').textContent = profile.nome || profile.email

  await loadAll()
  renderDashboard()
  renderTenants()
  renderUsers()
  renderLogs()
})()

async function loadAll() {
  try {
    TENANTS = await getTenants()
    USERS   = await getProfiles()
  } catch (e) {
    toast('Erro ao carregar dados: ' + e.message, 'error')
  }
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
window.showPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  document.getElementById('nav-' + page).classList.add('active')
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const ativos  = TENANTS.filter(t => t.status === 'ATIVO').length
  const trials  = TENANTS.filter(t => t.plano === 'TRIAL').length
  const pro     = TENANTS.filter(t => ['PRO','ENTERPRISE'].includes(t.plano)).length
  document.getElementById('kpi-tenants').textContent = ativos
  document.getElementById('kpi-users').textContent   = USERS.filter(u => u.role !== 'manager_global').length
  document.getElementById('kpi-trial').textContent   = trials
  document.getElementById('kpi-pro').textContent     = pro

  const recent = [...TENANTS].sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em)).slice(0,5)
  document.getElementById('dash-tenants-tbody').innerHTML = recent.map(t => `
    <tr>
      <td><strong>${esc(t.nome)}</strong></td>
      <td>${chipPlano(t.plano)}</td>
      <td>${chipStatus(t.status)}</td>
      <td>${esc(new Date(t.criado_em).toLocaleDateString('pt-BR'))}</td>
    </tr>`).join('')
}

// ============================================================
// EMPRESAS
// ============================================================
function renderTenants() {
  document.getElementById('tenants-tbody').innerHTML = TENANTS.map(t => {
    const usersCount = USERS.filter(u => u.tenant_id === t.id).length
    return `<tr>
      <td><strong>${esc(t.nome)}</strong><br><span style="font-size:11px;color:var(--muted);">${esc(t.slug)}</span></td>
      <td><span style="font-size:11px;color:var(--muted);">${esc(t.slug)}</span></td>
      <td style="font-size:12px;color:var(--muted);">${esc(t.email_admin)}</td>
      <td style="font-size:11px;">${esc(t.email_financeiro||'—')}</td>
      <td style="font-size:11px;">${esc(t.email_rh||'—')}</td>
      <td>${chipPlano(t.plano)}</td>
      <td style="text-align:center;">${esc(usersCount)} / ${esc(t.max_usuarios)}</td>
      <td>${chipStatus(t.status)}</td>
      <td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm" onclick="editTenant('${esc(t.id)}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="toggleTenant('${esc(t.id)}','${esc(t.status)}')">
          ${t.status === 'ATIVO' ? 'Suspender' : 'Ativar'}
        </button>
      </div></td>
    </tr>`}).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">Nenhuma empresa cadastrada.</td></tr>'
}

window.openModalTenant = function(tenant = null) {
  document.getElementById('mTenant-title').textContent = tenant ? 'Editar Empresa' : 'Nova Empresa'
  document.getElementById('tId').value       = tenant?.id || ''
  document.getElementById('tNome').value     = tenant?.nome || ''
  document.getElementById('tSlug').value     = tenant?.slug || ''
  document.getElementById('tEmail').value    = tenant?.email_admin || ''
  document.getElementById('tEmailFin').value  = tenant?.email_financeiro || ''
  document.getElementById('tEmailRH').value   = tenant?.email_rh || ''
  document.getElementById('tCnpj').value      = tenant?.cnpj || ''
  document.getElementById('tTelefone').value  = tenant?.telefone || ''
  document.getElementById('tEndereco').value  = tenant?.endereco || ''
  document.getElementById('tPlano').value    = tenant?.plano || 'TRIAL'
  document.getElementById('tMaxUsers').value = tenant?.max_usuarios || 10
  document.getElementById('tStatus').value   = tenant?.status || 'ATIVO'
  openModal('mTenant')
}

window.editTenant = function(id) {
  openModalTenant(TENANTS.find(t => t.id === id))
}

window.saveTenant = async function() {
  const id   = document.getElementById('tId').value
  const data = {
    nome:             document.getElementById('tNome').value.trim(),
    slug:             document.getElementById('tSlug').value.trim().toLowerCase().replace(/\s+/g,'-'),
    email_admin:      document.getElementById('tEmail').value.trim().toLowerCase(),
    email_financeiro: document.getElementById('tEmailFin').value.trim().toLowerCase() || null,
    email_rh:         document.getElementById('tEmailRH').value.trim().toLowerCase() || null,
    cnpj:             document.getElementById('tCnpj').value.trim() || null,
    telefone:         document.getElementById('tTelefone').value.trim() || null,
    endereco:         document.getElementById('tEndereco').value.trim() || null,
    plano:            document.getElementById('tPlano').value,
    max_usuarios:     parseInt(document.getElementById('tMaxUsers').value) || 10,
    status:           document.getElementById('tStatus').value
  }
  if (!data.nome || !data.slug || !data.email_admin) { toast('Preencha os campos obrigatórios','error'); return }

  try {
    if (id) {
      await updateTenant(id, data)
      toast('Empresa atualizada', 'success')
    } else {
      await criarTenant(data)
      toast('Empresa criada com sucesso', 'success')
    }
    closeModal('mTenant')
    await loadAll(); renderDashboard(); renderTenants()
  } catch (e) {
    toast('Erro: ' + e.message, 'error')
  }
}

window.toggleTenant = async function(id, status) {
  const novo = status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO'
  try {
    await updateTenant(id, { status: novo })
    toast('Status atualizado', 'success')
    await loadAll(); renderDashboard(); renderTenants()
  } catch (e) { toast('Erro: '+e.message,'error') }
}

window.autoSlug = function() {
  const nome  = document.getElementById('tNome').value
  const slugEl = document.getElementById('tSlug')
  if (!document.getElementById('tId').value) {
    slugEl.value = nome.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }
}

// ============================================================
// USUÁRIOS
// ============================================================
function renderUsers() {
  const filtroTenant = document.getElementById('filtro-tenant')?.value || ''
  const filtroRole   = document.getElementById('filtro-role')?.value || ''

  // Popular select de tenant no filtro
  const sel = document.getElementById('filtro-tenant')
  if (sel && sel.options.length === 1) {
    TENANTS.forEach(t => {
      const opt = document.createElement('option')
      opt.value = t.id; opt.textContent = t.nome
      sel.appendChild(opt)
    })
  }

  let users = USERS.filter(u => u.role !== 'manager_global')
  if (filtroTenant) users = users.filter(u => u.tenant_id === filtroTenant)
  if (filtroRole)   users = users.filter(u => u.role === filtroRole)

  document.getElementById('users-tbody').innerHTML = users.map(u => {
    const tenant = TENANTS.find(t => t.id === u.tenant_id)
    return `<tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td style="font-size:12px;color:var(--muted);">${esc(u.email)}</td>
      <td style="font-size:12px;">${esc(tenant?.nome || '—')}</td>
      <td>${chipRole(u.role)}</td>
      <td>${u.status === 'ATIVO' ? '<span class="chip chip-ativo">Ativo</span>' : '<span class="chip chip-inativo">Inativo</span>'}</td>
      <td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-danger" onclick="toggleUser('${esc(u.id)}','${esc(u.status)}')">
          ${u.status === 'ATIVO' ? 'Bloquear' : 'Ativar'}
        </button>
        <button class="btn btn-sm" style="background:rgba(155,102,244,.15);color:var(--accent);" onclick="resetUserPassword('${esc(u.id)}','${esc(u.email)}')">
          Redefinir senha
        </button>
      </div></td>
    </tr>`}).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">Nenhum usuário encontrado.</td></tr>'
}

window.openModalUser = function() {
  document.getElementById('uNome').value  = ''
  document.getElementById('uEmail').value = ''
  document.getElementById('uRole').value  = 'master'

  const sel = document.getElementById('uTenant')
  sel.innerHTML = TENANTS.map(t => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join('')

  openModal('mUser')
}

window.saveUser = async function() {
  const tenantId = document.getElementById('uTenant').value
  const nome     = document.getElementById('uNome').value.trim()
  const email    = document.getElementById('uEmail').value.trim().toLowerCase()
  const role     = document.getElementById('uRole').value

  if (!tenantId || !nome || !email) { toast('Preencha todos os campos','error'); return }

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password: 'lumarh',
      options: {
        data: { nome },
        emailRedirectTo: window.location.origin + '/login.html'
      }
    })
    if (error) throw error

    if (data.user) {
      await sb.from('profiles').upsert({
        id: data.user.id, tenant_id: tenantId, nome, email, role, status: 'ATIVO'
      }, { onConflict: 'id' })
    }

    toast(`Usuário ${nome} criado com senha padrão lumarh.`, 'success')
    closeModal('mUser')
    await loadAll(); renderUsers()
  } catch (e) {
    toast('Erro: ' + e.message, 'error')
  }
}

window.toggleUser = async function(id, status) {
  const novo = status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
  try {
    await updateProfile(id, { status: novo })
    toast('Status do usuário atualizado', 'success')
    await loadAll(); renderUsers()
  } catch (e) { toast('Erro: '+e.message,'error') }
}

window.resetUserPassword = async function(userId, email) {
  if (!confirm(`Redefinir senha de ${email} para "lumarh"?\n\nO usuário será obrigado a criar nova senha no próximo acesso.`)) return
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'apikey': SB_SERVICE_KEY,
        'Authorization': `Bearer ${SB_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: 'lumarh' })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Falha ao redefinir senha')
    }
    toast(`Senha de ${email} redefinida para "lumarh". Informe o usuário.`, 'success')
  } catch (e) { toast('Erro: '+e.message, 'error') }
}

// ============================================================
// LOGS
// ============================================================
async function renderLogs() {
  try {
    const { data } = await sb.from('log_eventos')
      .select('*, tenants(nome)')
      .order('criado_em', { ascending: false })
      .limit(100)
    document.getElementById('logs-tbody').innerHTML = (data||[]).map(l => `
      <tr>
        <td style="font-size:12px;white-space:nowrap;">${esc(new Date(l.criado_em).toLocaleString('pt-BR'))}</td>
        <td><code style="font-size:11px;color:var(--accent2);">${esc(l.tipo)}</code></td>
        <td style="font-size:12px;">${esc(l.tenants?.nome||'—')}</td>
        <td style="font-size:12px;color:var(--muted);">${esc(l.descricao||'')}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">Sem logs.</td></tr>'
  } catch (e) { console.warn(e) }
}

// ============================================================
// HELPERS
// ============================================================
function chipPlano(p) {
  const m = {TRIAL:'chip-trial',BASICO:'chip-basico',PRO:'chip-pro',ENTERPRISE:'chip-enterprise'}
  return `<span class="chip ${m[p]||'chip-trial'}">${p}</span>`
}
function chipStatus(s) {
  const m = {ATIVO:'chip-ativo',INATIVO:'chip-inativo',SUSPENSO:'chip-suspenso'}
  return `<span class="chip ${m[s]||''}">${s}</span>`
}
function chipRole(r) {
  const m = {master:'color:#c4b5fd;background:rgba(155,102,244,.15)',gestor:'color:#ffd000;background:rgba(255,208,0,.1)',rh:'color:#93c5fd;background:rgba(37,99,235,.12)',colaborador:'color:var(--muted);background:var(--bg3)'}
  return `<span class="chip" style="${m[r]||''};font-size:11px;">${r}</span>`
}
function openModal(id)  { document.getElementById(id).classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open') }
window.closeModal = closeModal

function toast(msg, type='success') {
  const tc = document.getElementById('tc')
  const t  = document.createElement('div')
  t.className = 'toast'
  const c = type==='success'?'#b98af7':type==='error'?'#f87171':'#ffd000'
  t.innerHTML = `<div class="tdot" style="background:${c}"></div><span>${msg}</span>`
  tc.appendChild(t)
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .25s'; setTimeout(()=>t.remove(),250) }, 3500)
}