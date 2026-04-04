import { sb, redefinirSenha } from './supabase_client.js'

function show(id) {
  ['screen-loading','screen-invalid','screen-form','screen-success'].forEach(s => {
    document.getElementById(s).style.display = s === id ? (id === 'screen-form' ? 'block' : 'block') : 'none'
  })
}

// Supabase PKCE: o link tem ?code=xxx na URL.
// O cliente JS troca o code por sessão automaticamente com detectSessionInUrl: true.
// Escutamos o evento PASSWORD_RECOVERY para exibir o formulário.

// Verifica se a URL tem o parâmetro ?code= (link genuíno de recuperação)
const _hasCode = new URL(window.location.href).searchParams.has('code')
if (!_hasCode) {
  // Se não tem code na URL, não é um link válido de recuperação
  show('screen-invalid')
}

const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    show('screen-form')
    document.getElementById('nova-senha').focus()
  } else if (event === 'SIGNED_IN' && window._awaitingRecovery) {
    // Alguns clientes emitem SIGNED_IN em vez de PASSWORD_RECOVERY
    show('screen-form')
    document.getElementById('nova-senha').focus()
  }
})

window._awaitingRecovery = true

// Fallback: se após 4s não receber evento MAS o code estava na URL,
// verifica se a troca de código gerou sessão
setTimeout(async () => {
  const formVisible = document.getElementById('screen-form').style.display !== 'none'
  const invalidVisible = document.getElementById('screen-invalid').style.display !== 'none'
  if (formVisible || invalidVisible) return
  if (!_hasCode) { show('screen-invalid'); return }
  const { data: { session } } = await sb.auth.getSession()
  if (session) {
    show('screen-form')
    document.getElementById('nova-senha').focus()
  } else {
    show('screen-invalid')
  }
}, 4000)

window.checkStrength = function(val) {
  const bar = document.getElementById('strength-bar')
  let score = 0
  if (val.length >= 8)           score++
  if (/[A-Z]/.test(val))        score++
  if (/[0-9]/.test(val))        score++
  if (/[^A-Za-z0-9]/.test(val)) score++
  const pct = [0, 25, 50, 75, 100][score]
  const cor = ['#ef4444','#f97316','#eab308','#22c55e'][score - 1] || '#2d2b45'
  bar.style.width = pct + '%'
  bar.style.background = cor
}

window.salvarSenha = async function() {
  const nova  = document.getElementById('nova-senha').value
  const conf  = document.getElementById('conf-senha').value
  const btn   = document.getElementById('btn-salvar')
  const alrt  = document.getElementById('alert-form')

  if (!nova || nova.length < 8) { showAlert(alrt,'error','A senha deve ter no mínimo 8 caracteres.'); return }
  if (!/[A-Z]/.test(nova))      { showAlert(alrt,'error','Inclua pelo menos uma letra maiúscula.'); return }
  if (!/[0-9]/.test(nova))      { showAlert(alrt,'error','Inclua pelo menos um número.'); return }
  if (nova !== conf)             { showAlert(alrt,'error','As senhas não coincidem.'); return }

  btn.disabled = true
  btn.textContent = 'Salvando...'
  alrt.style.display = 'none'

  try {
    await redefinirSenha(nova)
    subscription.unsubscribe()
    // Encerra a sessão de recuperação → usuário precisa logar com a nova senha
    // (sem isso, login.html detecta a sessão ativa e redireciona sem pedir login)
    await sb.auth.signOut()
    show('screen-success')
    let c = 3
    const cd = document.getElementById('countdown')
    const t = setInterval(() => {
      c--; cd.textContent = c
      if (c <= 0) { clearInterval(t); window.location.href = './login.html' }
    }, 1000)
  } catch (e) {
    showAlert(alrt, 'error', e.message || 'Erro ao salvar senha.')
    btn.disabled = false
    btn.textContent = 'Salvar nova senha'
  }
}

function showAlert(el, type, msg) {
  el.className = `alert ${type}`
  el.textContent = msg
  el.style.display = 'block'
}