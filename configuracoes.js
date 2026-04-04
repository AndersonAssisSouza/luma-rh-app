import {
  sb, requireAuth, logout,
  getTenantConfig, saveTenantConfig, applyTenantTheme
} from './supabase_client.js'

window._sbLogout = () => logout()

;(async () => {
  const profile = await requireAuth(['master','manager_global'])
  if (!profile) return
  window._profile = profile
  window._getTenantConfig  = getTenantConfig
  window._saveTenantConfig = saveTenantConfig
  window._applyTheme       = applyTenantTheme
  document.dispatchEvent(new Event('auth-ready'))
})()