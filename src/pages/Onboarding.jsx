import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function OnboardingPage() {
  const { isManagerGlobal } = useAuthStore()
  const [form, setForm] = useState({
    nome: '', email_admin: '', email_rh: '',
    cnpj: '', telefone: '', plano: 'TRIAL'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = (k, extra = {}) => (
    <input value={form[k]} onChange={e => set(k, e.target.value)} className="luma-input" {...extra} />
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('criar_tenant', {
      p_nome:        form.nome,
      p_email_admin: form.email_admin,
      p_email_rh:    form.email_rh || null,
      p_cnpj:        form.cnpj || null,
      p_telefone:    form.telefone || null,
      p_plano:       form.plano,
    })
    setSaving(false)
    if (err) return setError(err.message)
    setSuccess(`Empresa criada com sucesso! ID do tenant: ${data}`)
    setForm({ nome: '', email_admin: '', email_rh: '', cnpj: '', telefone: '', plano: 'TRIAL' })
  }

  if (!isManagerGlobal()) return (
    <div className="p-8 text-center">
      <div className="luma-card p-10 max-w-sm mx-auto">
        <div className="text-3xl mb-3">🔒</div>
        <p className="text-gray-400">Acesso exclusivo Manager Global.</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Nova Empresa</h1>
        <p className="text-gray-500 text-sm mt-1">Cadastro de novo tenant na plataforma LUMA RH</p>
      </div>

      <div className="luma-card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Nome da empresa *</label>
            {inp('nome', { placeholder: 'Ex: Escritório ABC Advogados', required: true })}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">E-mail do administrador *</label>
            {inp('email_admin', { type: 'email', placeholder: 'admin@empresa.com.br', required: true })}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">E-mail do RH (para alertas)</label>
            {inp('email_rh', { type: 'email', placeholder: 'rh@empresa.com.br' })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">CNPJ</label>
              {inp('cnpj', { placeholder: '00.000.000/0001-00' })}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Telefone</label>
              {inp('telefone', { placeholder: '(31) 3000-0000' })}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Plano</label>
            <select value={form.plano} onChange={e => set('plano', e.target.value)} className="luma-input">
              {['TRIAL','STARTER','PRO','ENTERPRISE'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {error   && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">
              <div>✓ {success}</div>
              <div className="mt-1 text-xs text-gray-400">
                Próximo passo: atribua o role <strong>master</strong> ao administrador na página Usuários.
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
            {saving ? 'Criando...' : 'Criar empresa'}
          </button>
        </form>
      </div>
    </div>
  )
}
