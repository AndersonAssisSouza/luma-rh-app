import {
  sb, requireAuth, logout, clearProfileCache,
  getColaboradorByEmail, getFeriasSaldo,
  getSolicitacoesFerias, criarSolicitacaoFerias, atualizarStatusSolicitacao,
  getSolicitacaoPorProtocolo, getProfiles, sendEmail
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
    getSolicitacaoPorProtocolo, getProfiles, sendEmail
  }

  // Função de inicialização: verifica URL de gestor (aprovação por link de e-mail)
  // e depois carrega o portal via Supabase (sem MSAL)
  const doInit = async () => {
    // checkGestorUrl está definido no HTML inline — verifica ?acao=&prot=
    if (typeof checkGestorUrl === 'function') {
      if (await checkGestorUrl()) return // modo gestor: aprovação/rejeição via link
    }
    // RH/gestor/master veem o painel de aprovação; colaborador vê o portal de solicitação
    const rhRoles = ['master','gestor','rh','manager_global']
    if (rhRoles.includes(profile.role)) {
      if (typeof loadRhPanel === 'function') { loadRhPanel(profile); return }
    }
    if (typeof loadPortalSb === 'function') { loadPortalSb(); return }
    setTimeout(doInit, 50)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(doInit, 0))
  } else {
    setTimeout(doInit, 0)
  }
})()