import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const ROLES = ['colaborador', 'gestor', 'rh', 'master']
const ROLE_LABELS = { colaborador: 'Colaborador', gestor: 'Gestor', rh: 'RH', master: 'Master', manager_global: 'Manager Global' }

export default function UsuariosPage() {
  const { tenant, isMaster } = useAuthStore()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ email: '', role: 'colaborador' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => { if (tenant) load() }, [tenant])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, role, status, criado_em')
      .eq('tenant_id', tenant.id)
      .order('role')
    setUsers(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    const { error: err } = await supabase.rpc('admin_set_profile_role', {
      p_email: form.email,
      p_role:  form.role,
    })
    setSaving(false)
    if (err) return setError(err.message)
    setSuccess(`Role de ${form.email} definido como ${form.role}.`)
    setForm({ email: '', role: 'colaborador' })
    load()
  }

  async function changeRole(userId, email, novoRole) {
    setSaving(true)
    const { error: err } = await supabase.rpc('admin_set_profile_role', {
      p_email: email, p_role: novoRole
    })
    setSaving(false)
    if (err) alert(err.message)
    else load()
  }

  if (!isMaster()) return (
    <div className="p-8 text-center">
      <div className="luma-card p-10 max-w-sm mx-auto">
        <div className="text-3xl mb-3">🔒</div>
        <p className="text-gray-400">Acesso restrito a Master e Manager Global.</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestão de Usuários</h1>
        <p className="text-gray-500 text-sm mt-1">Controle de acesso por perfil</p>
      </div>

      {/* Convidar / atribuir role */}
      <div className="luma-card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Atribuir perfil de acesso
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          O usuário precisa ter feito o primeiro login antes. Se ainda não tem conta, ele deve acessar o sistema e entrar com Magic Link.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="email@empresa.com.br"
            required
            className="luma-input flex-1 min-w-48"
          />
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="luma-input w-36"
          >
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '...' : 'Atribuir'}
          </button>
        </form>
        {error   && <div className="mt-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mt-3 text-sm text-emerald-400">✓ {success}</div>}
      </div>

      {/* Lista de usuários */}
      <div className="luma-card overflow-hidden">
        <table className="luma-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Role atual</th>
              <th>Status</th>
              <th>Desde</th>
              <th>Alterar role</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(5)].map((_, j) => <td key={j}><div className="h-4 bg-luma-dark2 rounded animate-pulse-soft" /></td>)}</tr>
              ))
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium text-gray-200">{u.nome}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </td>
                <td>
                  <span className="text-xs px-2 py-1 rounded bg-luma-purple/15 text-luma-purplel font-medium">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td>
                  <span className={`text-xs font-medium ${u.status === 'ATIVO' ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="text-xs text-gray-500 font-mono">
                  {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                </td>
                <td>
                  {u.role !== 'manager_global' && (
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, u.email, e.target.value)}
                      disabled={saving}
                      className="text-xs bg-luma-dark1 border border-[var(--luma-border)] rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-luma-purple"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
