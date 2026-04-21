import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

function Stat({ label, value, sub, color = 'text-luma-purplel', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`luma-card p-5 flex flex-col gap-1 animate-slide-up ${onClick ? 'cursor-pointer hover:border-luma-purple/40 transition-colors' : ''}`}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-3xl font-bold ${color} leading-none`}>{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { tenant, profile } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenant) return
    loadStats()
  }, [tenant])

  async function loadStats() {
    setLoading(true)
    const tid = tenant.id

    const [colabs, alertas, ferias, exames] = await Promise.all([
      supabase.from('colaboradores').select('id,tipo_vinculo,status', { count: 'exact' })
        .eq('tenant_id', tid).eq('status', 'ATIVO'),
      supabase.from('alertas_agente').select('id,prioridade', { count: 'exact' })
        .eq('tenant_id', tid).in('status', ['ABERTO', 'CIENTE']),
      supabase.from('ferias_saldo').select('id,status_ferias')
        .eq('tenant_id', tid),
      supabase.from('exames_ocupacionais').select('id,status_exame')
        .eq('tenant_id', tid),
    ])

    const criticos = alertas.data?.filter(a => a.prioridade === 'CRITICO').length ?? 0
    const altas    = alertas.data?.filter(a => a.prioridade === 'ALTA').length ?? 0

    const vinculoMap = {}
    colabs.data?.forEach(c => {
      vinculoMap[c.tipo_vinculo] = (vinculoMap[c.tipo_vinculo] ?? 0) + 1
    })

    setStats({
      ativos: colabs.count ?? 0,
      vinculoMap,
      totalAlertas: alertas.count ?? 0,
      criticos,
      altas,
      feriasVencidas: ferias.data?.filter(f => f.status_ferias === 'VENCIDA').length ?? 0,
      examesVencidos: exames.data?.filter(e => e.status_exame === 'VENCIDO').length ?? 0,
    })
    setLoading(false)
  }

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Olá, {profile?.nome?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{hoje}</p>
        </div>
        {tenant && (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-300">{tenant.nome}</div>
            <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{tenant.plano}</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="luma-card p-5 h-24 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Colaboradores ativos"
              value={stats.ativos}
              sub="todos os vínculos"
              color="text-luma-purplel"
            />
            <Stat
              label="Alertas abertos"
              value={stats.totalAlertas}
              sub={stats.criticos > 0 ? `${stats.criticos} crítico(s)` : 'nenhum crítico'}
              color={stats.criticos > 0 ? 'text-red-400' : stats.altas > 0 ? 'text-orange-400' : 'text-emerald-400'}
              onClick={() => navigate('/alertas')}
            />
            <Stat
              label="Férias vencidas"
              value={stats.feriasVencidas}
              sub="CLT sem programação"
              color={stats.feriasVencidas > 0 ? 'text-red-400' : 'text-emerald-400'}
              onClick={() => navigate('/ferias')}
            />
            <Stat
              label="Exames vencidos"
              value={stats.examesVencidos}
              sub="ASO / PCMSO"
              color={stats.examesVencidos > 0 ? 'text-red-400' : 'text-emerald-400'}
              onClick={() => navigate('/exames')}
            />
          </div>

          {/* Composição por vínculo */}
          <div className="luma-card p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
              Composição por vínculo
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.vinculoMap).sort((a, b) => b[1] - a[1]).map(([vinculo, qtd]) => (
                <div key={vinculo} className="flex items-center gap-3 bg-luma-dark1 rounded-lg px-4 py-3">
                  <VinculoDot vinculo={vinculo} />
                  <div>
                    <div className="text-lg font-bold text-white leading-none">{qtd}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">{vinculo}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas urgentes preview */}
          {stats.totalAlertas > 0 && (
            <AlertasPreview tenantId={tenant.id} onVerTodos={() => navigate('/alertas')} />
          )}
        </>
      )}
    </div>
  )
}

function VinculoDot({ vinculo }) {
  const colors = {
    CLT:        'bg-luma-purple',
    PJ:         'bg-luma-gold',
    ASSOCIADO:  'bg-emerald-400',
    ESTAGIARIO: 'bg-sky-400',
    SOCIO:      'bg-pink-400',
    MEI:        'bg-orange-400',
  }
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[vinculo] ?? 'bg-gray-500'}`} />
}

function AlertasPreview({ tenantId, onVerTodos }) {
  const [alertas, setAlertas] = useState([])

  useEffect(() => {
    supabase
      .from('alertas_agente')
      .select('id,prioridade,tipo,titulo,colaboradores(nome)')
      .eq('tenant_id', tenantId)
      .in('status', ['ABERTO', 'CIENTE'])
      .in('prioridade', ['CRITICO', 'ALTA'])
      .order('prioridade')
      .limit(5)
      .then(({ data }) => setAlertas(data ?? []))
  }, [tenantId])

  if (!alertas.length) return null

  return (
    <div className="luma-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Alertas prioritários
        </h2>
        <button onClick={onVerTodos} className="text-xs text-luma-purplel hover:underline">
          Ver todos →
        </button>
      </div>
      <div className="space-y-2">
        {alertas.map(a => (
          <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-[var(--luma-border)] last:border-0">
            <PrioBadge p={a.prioridade} />
            <div className="min-w-0">
              <div className="text-sm text-gray-200 font-medium truncate">{a.titulo}</div>
              {a.colaboradores?.nome && (
                <div className="text-xs text-gray-500 mt-0.5">{a.colaboradores.nome}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrioBadge({ p }) {
  if (p === 'CRITICO') return <span className="badge-critico shrink-0">●</span>
  if (p === 'ALTA')    return <span className="badge-alta shrink-0">●</span>
  if (p === 'ATENCAO') return <span className="badge-atencao shrink-0">●</span>
  return <span className="badge-acomp shrink-0">●</span>
}
