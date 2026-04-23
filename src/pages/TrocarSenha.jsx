import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/auth"

export default function TrocarSenhaPage() {
  const navigate = useNavigate()
  const { loadProfile, user } = useAuthStore()
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro("")
    if (senha.length < 8) { setErro("Minimo 8 caracteres."); return }
    if (senha !== confirmar) { setErro("As senhas nao coincidem."); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id)
      await loadProfile(user)
      setSucesso(true)
      setTimeout(() => navigate("/dashboard"), 1500)
    } catch (e) { setErro(e.message) }
    finally { setLoading(false) }
  }

  if (sucesso) return (
    <div className="min-h-screen bg-luma-ink flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold text-white">Senha definida!</h2>
      <p className="text-gray-400 mt-2">Redirecionando...</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-luma-ink flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-luma-purple flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="#ffd000" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#ffd000" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Defina sua senha</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">Crie uma senha pessoal para continuar.</p>
        </div>
        <div className="luma-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase">Nova senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Minimo 8 caracteres" required className="luma-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase">Confirmar senha</label>
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repita a senha" required className="luma-input" />
            </div>
            {erro && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{erro}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
