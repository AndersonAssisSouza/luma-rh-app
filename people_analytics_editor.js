import {
  sb, requireAuth, logout, getProfileCached,
  getColaboradores, getAllFeriasSaldo, getExames, getAusencias,
  getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
  getColaboradorByEmail, getFeriasSaldo, getSolicitacaoPorProtocolo,
  getDesligamentosAgendados, agendarDesligamento, marcarLembreteEnviado,
  updateColaborador, upsertColaborador, gerarIdColaborador,
  updateFeriasSaldo, updateExame, inserirAusencia, updateAusencia,
  getProfiles, updateProfile, updateProfileRoleByEmail, logEvento,
  getMensagensAniversario, seedMensagensDefault,
  getTenantConfig, updateTenant, applyTenantTheme, sendEmail, extractDocument
} from './supabase_client.js'

window._sbLogout = () => logout()
window._sb = sb
window._sbClient = sb   // alias para Storage (verAtestado, upload atestado)

;(async () => {
  // colaborador → Portal de Férias (acesso direto à URL do admin bloqueado)
  const _pre = await getProfileCached()
  if (_pre?.role === 'colaborador') {
    window.location.href = './portal_ferias_colaborador.html'
    return
  }

  const profile = await requireAuth(['master','gestor','rh','manager_global'])
  if (!profile) return

  window._sbProfile        = profile
  window.USER_EMAIL        = profile.email
  window.USER_NOME         = profile.nome
  window._sbRole           = profile.role === 'manager_global' ? 'master' : profile.role
  window._sbIsManagerGlobal = profile.role === 'manager_global'
  window._sbTenantId       = profile.tenant_id

  // Expõe funções Supabase para o script legado
  window._sbFns = {
    getColaboradores, getAllFeriasSaldo, getExames, getAusencias,
    getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
    getColaboradorByEmail, getFeriasSaldo, getSolicitacaoPorProtocolo,
    getDesligamentosAgendados, agendarDesligamento, marcarLembreteEnviado,
    updateColaborador, upsertColaborador, gerarIdColaborador,
    updateFeriasSaldo, updateExame, inserirAusencia, updateAusencia,
    getProfiles, updateProfile, updateProfileRoleByEmail, logEvento,
    getMensagensAniversario, seedMensagensDefault, sendEmail, extractDocument,
    updateTenant, getTenantConfig
  }

  // Aplica tema do tenant (cores + logo + modelos)
  try {
    const tenantData = await getTenantConfig()
    applyTenantTheme(tenantData.config || {})
    if (Array.isArray(tenantData.config?.modelos)) {
      window._tenantModelos = tenantData.config.modelos
    }
    // Popula topbar e sidebar com dados do tenant
    const nomeEmpresa = tenantData.nome || 'LUMA RH'
    const planoTxt = tenantData.plano || 'Pro'
    const el = id => document.getElementById(id)
    if (el('tb-empresa')) el('tb-empresa').textContent = nomeEmpresa
    if (el('tb-plano'))   el('tb-plano').textContent   = 'Plano ' + planoTxt
    if (el('sb-empresa')) el('sb-empresa').textContent = nomeEmpresa
  } catch (_) {}

  // Popula nome e avatar do usuário no topbar
  try {
    const nome = profile.nome || profile.email || 'Usuário'
    const iniciais = nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()
    const el = id => document.getElementById(id)
    if (el('tb-nome'))   el('tb-nome').textContent   = nome.split(' ')[0]
    if (el('tb-avatar')) el('tb-avatar').textContent = iniciais
  } catch (_) {}

  // Oculta tela de config — não é mais necessária
  const sc = document.getElementById('sConfig')
  if (sc) sc.classList.add('hidden')

  // Atualiza botão Sair para usar Supabase logout
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[onclick*="msalApp"], [onclick*="logoutRedirect"]').forEach(b => {
      b.setAttribute('onclick', '_sbLogout()')
    })
  })

  // Auto-inicia carregamento de dados (sem precisar de MSAL/Excel)
  const doStart = () => {
    if (typeof loadAll === 'function') { loadAll(); return }
    setTimeout(doStart, 50)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(doStart, 0))
  } else {
    setTimeout(doStart, 0)
  }
})()