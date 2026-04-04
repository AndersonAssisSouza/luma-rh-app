import {
  sb, requireAuth, logout,
  getMensagensAniversario, upsertMensagemAniversario,
  deleteMensagemAniversario, seedMensagensDefault, getProfileCached,
  getTenantConfig, applyTenantTheme
} from './supabase_client.js'

window._sbLogout = () => logout()

;(async () => {
  const profile = await requireAuth(['master','rh','gestor','manager_global'])
  if (!profile) return
  window._profile = profile

  // Expõe funções
  window._getMsgs    = getMensagensAniversario
  window._upsertMsg  = upsertMensagemAniversario
  window._deleteMsg  = deleteMensagemAniversario
  window._seedMsgs   = () => seedMensagensDefault(profile.tenant_id)
  window._getProfile = getProfileCached

  // Aplica tema do tenant (cores + logo) e carrega modelos
  try {
    const tenantData = await getTenantConfig()
    applyTenantTheme(tenantData.config || {})
    // Guarda modelos para uso na geração de cards
    if (Array.isArray(tenantData.config?.modelos)) {
      window._tenantModelos = tenantData.config.modelos
    }
  } catch (_) {}

  // Sinaliza que auth completou
  window._authReady = true
  document.dispatchEvent(new Event('auth-ready'))
})()