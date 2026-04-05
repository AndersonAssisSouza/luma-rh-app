import {
  sb, requireAuth, logout, clearProfileCache,
  getColaboradorByEmail, getFeriasSaldo,
  getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
  getSolicitacaoPorProtocolo, getProfiles
} from './supabase_client.js'

window._sbLogout = () => logout()
window._sb = sb

;(async () => {
  // Limpa cache para garantir que carrega o perfil do usuário atual, não de sessão anterior
  clearProfileCache()
  const profile = await requireAuth(['colaborador','master','gestor','rh','manager_global'])
  if (!profile) return
  window._sbProfile = profile
  window._sbUserEmail = profile.email
  window._sbFnsPortal = {
    getColaboradorByEmail, getFeriasSaldo,
    getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
    getSolicitacaoPorProtocolo, getProfiles
  }
  // Auto-inicia o portal após DOM pronto
  const doStart = () => {
    if (typeof loadPortalSb === 'function') { loadPortalSb(); return }
    setTimeout(doStart, 50)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(doStart, 0))
  } else {
    setTimeout(doStart, 0)
  }
})()