import { sb, logout } from './supabase_client.js'
window.doLogout = () => logout()
window.goHome  = () => window.location.href = './index.html'
;(async () => {
  const { data: { user } } = await sb.auth.getUser()
  if (user) document.getElementById('user-info').textContent = 'Logado como: ' + user.email
})()