import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const { user, loading, error, signIn, signInMagicLink } = useAuthStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('password') // 'password' | 'magic'
  const [magicSent, setMagicSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    if (mode === 'password') {
      await signIn(email, password)
    } else {
      const ok = await signInMagicLink(email)
      if (ok) setMagicSent(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-luma-ink flex items-center justify-center p-4">
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-luma-purple/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-luma-gold/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-luma-purple/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-luma-purple flex items-center justify-center mb-4 shadow-lg shadow-luma-purple/30">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 24 L12 8 L16 16 L20 8 L26 24" stroke="#ffd000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">LUMA RH</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de pessoas, simplificada</p>
        </div>

        {/* Card */}
        <div className="luma-card p-8">
          {magicSent ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="text-4xl mb-4">✉️</div>
              <h2 className="text-lg font-semibold text-white mb-2">Verifique seu e-mail</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Enviamos um link de acesso para<br/>
                <span className="text-luma-purplel font-medium">{email}</span>
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 tracking-wide uppercase">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="luma-input"
                />
              </div>

              {mode === 'password' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium text-gray-400 mb-2 tracking-wide uppercase">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="luma-input"
                  />
                </div>
              )}

              {(error) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 animate-fade-in">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || loading}
                className="btn-primary w-full justify-center py-3"
              >
                {submitting || loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                    </svg>
                    Entrando...
                  </span>
                ) : mode === 'password' ? 'Entrar' : 'Enviar link de acesso'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
                  className="text-xs text-gray-500 hover:text-luma-purplel transition-colors"
                >
                  {mode === 'password'
                    ? 'Prefiro entrar por link no e-mail'
                    : 'Entrar com senha'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          LUMA RH © {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
