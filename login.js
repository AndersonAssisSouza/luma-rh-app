import { sb, login, solicitarResetSenha, getProfileCached } from './supabase_client.js'

// ── Brute-force protection ──
const _RF_MAX  = 5           // tentativas antes de bloquear
const _RF_MS   = 5 * 60000  // 5 minutos de bloqueio
const _rfKey   = e => '_luma_rf_' + e.toLowerCase().trim()
const _rfGet   = e => { try { return JSON.parse(sessionStorage.getItem(_rfKey(e)) || 'null') } catch { return null } }
const _rfSet   = (e, d) => sessionStorage.setItem(_rfKey(e), JSON.stringify(d))
const _rfClear = e => sessionStorage.removeItem(_rfKey(e))

function _rfCheck(email, alertEl) {
  const d = _rfGet(email)
  if (d?.lockedUntil && Date.now() < d.lockedUntil) {
    const s = Math.ceil((d.lockedUntil - Date.now()) / 1000)
    showAlert(alertEl, 'error', `Muitas tentativas incorretas. Aguarde ${s}s para tentar novamente.`)
    return true
  }
  return false
}

function _rfFail(email) {
  const d = _rfGet(email) || { attempts: 0 }
  d.attempts = (d.attempts || 0) + 1
  if (d.attempts >= _RF_MAX) d.lockedUntil = Date.now() + _RF_MS
  _rfSet(email, d)
}

window.doLogin = async function() {
  const email  = document.getElementById('login-email').value.trim()
  const senha  = document.getElementById('login-senha').value
  const btn    = document.getElementById('btn-entrar')
  const alert  = document.getElementById('alert-login')

  if (!email || !senha) { showAlert(alert,'error','Preencha e-mail e senha.'); return }
  if (_rfCheck(email, alert)) return

  btn.disabled = true
  btn.textContent = 'Entrando...'
  hideAlert(alert)

  try {
    const senhaDigitada = senha
    await login(email, senha)
    _rfClear(email)

    // Senha padrão → forçar troca antes de entrar
    if (senhaDigitada === 'lumarh') {
      window.location.href = './trocar-senha.html'
      return
    }

    // Redirecionar conforme o role
    const profile = await getProfileCached()
    if (!profile) throw new Error('Perfil não encontrado.')

    if (profile.role === 'manager_global') {
      window.location.href = './manager.html'
    } else if (profile.role === 'colaborador') {
      window.location.href = './portal_ferias_colaborador.html'
    } else {
      window.location.href = './people_analytics_editor.html'
    }
  } catch (e) {
    _rfFail(email)
    const d = _rfGet(email)
    const locked = d?.lockedUntil && Date.now() < d.lockedUntil
    const msg = locked
      ? `Conta bloqueada por 5 minutos após ${_RF_MAX} tentativas incorretas.`
      : e.message?.includes('Invalid login') ? 'E-mail ou senha incorretos.' : e.message
    showAlert(alert, 'error', msg)
    btn.disabled = false
    btn.textContent = 'Entrar'
  }
}

window.doReset = async function() {
  const email  = document.getElementById('reset-email').value.trim()
  const btn    = document.getElementById('btn-reset')
  const alert  = document.getElementById('alert-reset')

  if (!email) { showAlert(alert,'error','Informe seu e-mail.'); return }

  btn.disabled = true
  btn.textContent = 'Enviando...'
  hideAlert(alert)

  try {
    await solicitarResetSenha(email)
    showAlert(alert, 'success', 'Link enviado! Verifique sua caixa de entrada.')
    btn.textContent = 'Reenviar link'
    btn.disabled = false
    // Volta para login automaticamente após 2,5 segundos
    setTimeout(() => { window.showLogin() }, 2500)
  } catch (e) {
    showAlert(alert, 'error', e.message)
    btn.disabled = false
    btn.textContent = 'Enviar link de redefinição'
  }
}

window.showReset = function() {
  document.getElementById('screen-login').style.display = 'none'
  document.getElementById('screen-reset').style.display = 'block'
  const re = document.getElementById('reset-email')
  const le = document.getElementById('login-email')
  if (le.value) re.value = le.value
  re.focus()
}

window.showLogin = function() {
  document.getElementById('screen-reset').style.display = 'none'
  document.getElementById('screen-login').style.display = 'block'
  document.getElementById('login-email').focus()
}

function showAlert(el, type, msg) {
  el.className = `alert ${type}`
  el.textContent = msg
  el.style.display = 'block'
}
function hideAlert(el) { el.style.display = 'none' }

// Enter para login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('screen-login').style.display !== 'none') doLogin()
    else doReset()
  }
})

// Se já logado, redirecionar
;(async () => {
  // Mostrar mensagem de sucesso após troca de senha
  if (new URLSearchParams(location.search).get('senha_redefinida') === '1') {
    const alrt = document.getElementById('alert-login')
    if (alrt) {
      alrt.className = 'alert success'
      alrt.textContent = '✓ Senha redefinida com sucesso! Faça login com sua nova senha.'
      alrt.style.display = 'block'
    }
    // Limpar o parâmetro da URL sem recarregar
    history.replaceState(null, '', location.pathname)
  }

  const { data: { session } } = await sb.auth.getSession()
  if (session) {
    const profile = await getProfileCached()
    if (profile?.role === 'manager_global') window.location.href = './manager.html'
    else if (profile?.role === 'colaborador') window.location.href = './portal_ferias_colaborador.html'
    else window.location.href = './people_analytics_editor.html'
  }
})()