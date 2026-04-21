import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function AprovarFeriasPage() {
  const { tenant, isGestor } = useAuthStore()
  const [solicitacoes, setSoliciatcoes] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtro, setFiltro]             = useState('PENDENTE')
  const [deciding, setDeciding]         = useState(null)
  const [motivo, setMotivo]             = useState('')
  const [showRejectFor, setShowRejectFor] = useState(null)

  useEffect(() => { if (tenant) load() }, [tenant, filtro])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('solicitacoes_ferias')
      .select(`
        id, protocolo, data_inicio, data_fim, dias_corridos, dias_uteis,
        status, motivo_rejeicao, solicitado_em, decisao_em, observacao,
        colaboradores ( nome, cargo, tipo_vinculo, gestor )
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', filtro)
      .order('solicitado_em', { ascending: true })
    setSoliciatcoes(data ?? [])
    setLoading(false)
  }

  async function decidir(id, decisao, mot = null) {
    setDeciding(id)
    const { error } = await supabase.rpc('decidir_ferias', {
      p_sol_id:  id,
      p_decisao: decisao,
      p_motivo:  mot,
    })
    setDeciding(null)
    setShowRejectFor(null)
    setMotivo('')
    if (error) return alert(error.message)
    load()
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Aprovação de Férias</h1>
          <p className="text-gray-500 text-sm mt-1">Solicitações pendentes de decisão</p>
        </div>
        <div className="flex rounded-lg border border-[var(--luma-border)] overflow-hidden">
          {[['PENDENTE','Pendentes'],['APROVADO','Aprovadas'],['REJEITADO','Rejeitadas']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${filtro === v ? 'bg-luma-purple text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="luma-card h-24 animate-pulse-soft" />)}
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="luma-card p-12 text-center">
          <div className="text-4xl mb-3">{filtro === 'PENDENTE' ? '✅' : '📋'}</div>
          <div className="text-gray-400">Nenhuma solicitação {filtro.toLowerCase()}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map(s => (
            <div key={s.id} className="luma-card p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">{s.protocolo}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-2 font-semibold text-gray-200">
                    {s.colaboradores?.nome ?? '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.colaboradores?.cargo ?? ''} · Gestor: {s.colaboradores?.gestor ?? 'N/D'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Período: </span>
                      <span className="text-gray-200">
                        {new Date(s.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {' → '}
                        {new Date(s.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Dias: </span>
                      <span className="text-gray-200">{s.dias_corridos} corridos · {s.dias_uteis} úteis</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Solicitado em: </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(s.solicitado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  {s.observacao && (
                    <div className="mt-2 text-xs text-gray-500 italic">"{s.observacao}"</div>
                  )}
                  {s.motivo_rejeicao && (
                    <div className="mt-2 text-xs text-red-400 italic">Motivo: {s.motivo_rejeicao}</div>
                  )}
                </div>

                {/* Ações */}
                {s.status === 'PENDENTE' && isGestor() && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => decidir(s.id, 'APROVADO')}
                      disabled={deciding === s.id}
                      className="btn-ghost text-xs border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      {deciding === s.id ? '...' : '✓ Aprovar'}
                    </button>
                    <button
                      onClick={() => setShowRejectFor(s.id)}
                      disabled={deciding === s.id}
                      className="btn-danger text-xs border border-red-500/20"
                    >
                      ✕ Rejeitar
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário de rejeição */}
              {showRejectFor === s.id && (
                <div className="mt-4 pt-4 border-t border-[var(--luma-border)] space-y-3 animate-fade-in">
                  <input
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Motivo da rejeição (obrigatório)..."
                    className="luma-input"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => decidir(s.id, 'REJEITADO', motivo)}
                      disabled={!motivo.trim() || deciding === s.id}
                      className="btn-primary text-sm"
                    >
                      Confirmar rejeição
                    </button>
                    <button
                      onClick={() => { setShowRejectFor(null); setMotivo('') }}
                      className="btn-ghost text-sm border border-[var(--luma-border)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'PENDENTE')  return <span className="badge-atencao">pendente</span>
  if (status === 'APROVADO')  return <span className="badge-acomp">aprovado</span>
  if (status === 'REJEITADO') return <span className="badge-critico">rejeitado</span>
  return null
}
