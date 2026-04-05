import { sb, redefinirSenha, getProfileCached } from './supabase_client.js'

function show(id) {
  ['screen-loading','screen-form','screen-success'].forEach(s => {
    document.getElementById(s).style.display = s === id ? 'block' : 'none'
  })
}

// Verifica sessão ativa — sem sessão volta para login
;(async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) {
    window.location.href = './login.html'
    return
  }
  show('screen-form')
  document.getElementById('nova-senha').focus()
})()

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
  const nova = document.getElementById('nova-senha').value
  const conf = document.getElementById('conf-senha').value
  const btn  = document.getElementById('btn-salvar')
  const alrt = document.getElementById('alert-form')

  if (!nova || nova.length < 8) { showAlert(alrt,'error','A senha deve ter no mínimo 8 caracteres.'); return }
  if (!/[A-Z]/.test(nova))      { showAlert(alrt,'error','Inclua pelo menos uma letra maiúscula.'); return }
  if (!/[0-9]/.test(nova))      { showAlert(alrt,'error','Inclua pelo menos um número.'); return }
  if (nova === 'lumarh')        { showAlert(alrt,'error','Você não pode usar a senha padrão. Escolha uma senha pessoal.'); return }
  if (nova !== conf)            { showAlert(alrt,'error','As senhas não coincidem.'); return }

  btn.disabled = true
  btn.textContent = 'Salvando...'
  alrt.style.display = 'none'

  try {
    await redefinirSenha(nova)
    show('screen-success')
    const profile = await getProfileCached()
    const dest = profile?.role === 'manager_global'
      ? './manager.html'
      : profile?.role === 'colaborador'
        ? './portal_ferias_colaborador.html'
        : './people_analytics_editor.html'

    let c = 3
    const cd = document.getElementById('countdown')
    const t = setInterval(() => {
      c--; cd.textContent = c
      if (c <= 0) { clearInterval(t); window.location.href = dest }
    }, 1000)
  } catch (e) {
    showAlert(alrt, 'error', e.message || 'Erro ao salvar senha.')
    btn.disabled = false
    btn.textContent = 'Definir senha e continuar'
  }
}

function showAlert(el, type, msg) {
  el.className = `alert ${type}`
  el.textContent = msg
  el.style.display = 'block'
}

// Enter para salvar
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') salvarSenha()
})
