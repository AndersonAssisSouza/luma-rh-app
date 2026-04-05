import { sb, getProfileCached, clearProfileCache } from './supabase_client.js'
;(async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { window.location.href = './login.html'; return }
  clearProfileCache()
  const profile = await getProfileCached()
  if (!profile) { window.location.href = './login.html'; return }

  if (profile.role === 'manager_global') { window.location.href = './manager.html'; return }
  if (profile.role === 'colaborador')    { window.location.href = './portal_ferias_colaborador.html'; return }
  window.location.href = './people_analytics_editor.html'
})()