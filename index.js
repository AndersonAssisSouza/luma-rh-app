import { sb, getProfileCached } from './supabase_client.js'
;(async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { window.location.href = './login.html'; return }
  const profile = await getProfileCached()
  if (!profile) { window.location.href = './login.html'; return }
  if (profile.role === 'manager_global') window.location.href = './manager.html'
  else window.location.href = './people_analytics_editor.html'
})()