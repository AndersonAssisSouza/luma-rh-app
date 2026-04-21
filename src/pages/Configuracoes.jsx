import { useAuthStore } from '@/store/auth'

export default function ConfigPage() {
  const { profile, tenant, signOut } = useAuthStore()

  return (
    <div className="p-8 max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Configurações</h1>

      {/* Perfil */}
      <div className="luma-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Meu Perfil</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-600 mb-1">Nome</div>
            <div className="text-gray-200">{profile?.nome ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">E-mail</div>
            <div className="text-gray-200">{profile?.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Perfil de acesso</div>
            <div className="text-luma-purplel font-medium capitalize">{profile?.role ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Status</div>
            <div className="text-emerald-400">{profile?.status ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Tenant */}
      {tenant && (
        <div className="luma-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Empresa</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-1">Nome</div>
              <div className="text-gray-200">{tenant.nome}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Plano</div>
              <div className="text-luma-gold font-medium">{tenant.plano}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Slug</div>
              <div className="text-gray-500 font-mono text-xs">{tenant.slug}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Status</div>
              <div className="text-emerald-400">{tenant.status}</div>
            </div>
            {tenant.email_rh && (
              <div>
                <div className="text-xs text-gray-600 mb-1">E-mail RH</div>
                <div className="text-gray-400 text-xs">{tenant.email_rh}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Informações do sistema */}
      <div className="luma-card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sistema</h2>
        <div className="text-xs text-gray-600 space-y-1.5">
          <div>LUMA RH — v0.1.0</div>
          <div>Backend: Supabase (ttclcdppifmmdjztfunl)</div>
          <div>Alertas automáticos: seg-sex 07:00 BRT (CRÍTICO+ALTA) · segunda 07:30 BRT (ATENÇÃO)</div>
        </div>
      </div>

      <button onClick={signOut} className="btn-danger border border-red-500/20">
        Sair da conta
      </button>
    </div>
  )
}
