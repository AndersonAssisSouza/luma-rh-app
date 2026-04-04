import {
  sb, requireAuth, logout,
  getColaboradores, getAllFeriasSaldo, getExames, getAusencias,
  getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
  getColaboradorByEmail, getFeriasSaldo, getSolicitacaoPorProtocolo,
  getDesligamentosAgendados, agendarDesligamento, marcarLembreteEnviado,
  updateColaborador, upsertColaborador, gerarIdColaborador,
  updateFeriasSaldo, updateExame, inserirAusencia,
  getProfiles, updateProfile, logEvento,
  getMensagensAniversario, seedMensagensDefault,
  getTenantConfig, applyTenantTheme
} from './supabase_client.js'

window._sbLogout = () => logout()
window._sb = sb

;(async () => {
  const profile = await requireAuth(['master','gestor','rh','manager_global','colaborador'])
  if (!profile) return

  window._sbProfile = profile
  window.USER_EMAIL  = profile.email
  window.USER_NOME   = profile.nome
  window._sbRole     = profile.role === 'manager_global' ? 'master' : profile.role
  window._sbTenantId = profile.tenant_id

  // Expõe funções Supabase para o script legado
  window._sbFns = {
    getColaboradores, getAllFeriasSaldo, getExames, getAusencias,
    getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
    getColaboradorByEmail, getFeriasSaldo, getSolicitacaoPorProtocolo,
    getDesligamentosAgendados, agendarDesligamento, marcarLembreteEnviado,
    updateColaborador, upsertColaborador, gerarIdColaborador,
    updateFeriasSaldo, updateExame, inserirAusencia,
    getProfiles, updateProfile, logEvento,
    getMensagensAniversario, seedMensagensDefault
  }

  // Aplica tema do tenant (cores + logo + modelos)
  try {
    const tenantData = await getTenantConfig()
    applyTenantTheme(tenantData.config || {})
    if (Array.isArray(tenantData.config?.modelos)) {
      window._tenantModelos = tenantData.config.modelos
    }
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