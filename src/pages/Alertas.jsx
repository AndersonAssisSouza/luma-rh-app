import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const PRIOS = ['CRITICO', 'ALTA', 'ATENCAO', 'ACOMPANHAMENTO']
const TIPOS = ['ASO', 'FERIAS', 'CONTRATO', 'CADASTRO', 'OUTRO']

const PRIO_META = {
  CRITICO:       { label: 'Crítico',      color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    dot: 'bg-red-500',    badge: 'badge-critico' },
  ALTA:          { label: 'Alta',         color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', dot: 'bg-orange-500', badge: 'badge-alta' },
  ATENCAO:       { label: 'Atenção',      color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400', badge: 'badge-atencao' },
  ACOMPANHAMENTO:{ label: 'Acompanham.',  color: 'text-emerald-400',border: 'border-emerald-500/30',bg: 'bg-emerald-500/10',dot: 'bg-emerald-400',badge: 'badge-acomp' },
}

const TIPO_LABEL = {
  ASO:      '🩺 ASO / Saúde',
  FERIAS:   '🌴 Férias',
  CONTRATO: '📄 Contrato',
  CADASTRO: '📋 Cadastro',
  OUTRO:    '⚠️ Outro',
}

export default function AlertasPage() {
  const { tenant } = useAuthStore()
  const [alertas, setAlertas]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [classifying, setClassifying]   = useState(false)
  const [filtroStatus, setFiltroStatus] = useState(['ABERTO', 'CIENTE'])
  const [filtroPrio, setFiltroPrio]     = useState([])
  const [filtroTipo, setFiltroTipo]     = useState([])
  const [expanded, setExpanded]         = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    let q = supabase
      .from('alertas_agente')
      .select(`
        id, tipo, subtipo, prioridade, titulo, descricao,
        base_legal, acao_recomendada, status, dados,
        criado_em, atualizado_em, resolvido_em,
        colaboradores ( id, nome, cargo, tipo_vinculo )
      `)
      .eq('tenant_id', tenant.id)
      .in('status', filtroStatus)
      .order('prioridade', { foreignTable: undefined })

    const { data } = await q
    // sort manual por prioridade
    const ord = { CRITICO: 0, ALTA: 1, ATENCAO: 2, ACOMPANHAMENTO: 3 }
    const sorted = (data ?? []).sort((a, b) => (ord[a.prioridade] ?? 9) - (ord[b.prioridade] ?? 9))
    setAlertas(sorted)
    setLoading(false)
  }, [tenant, filtroStatus])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!tenant) return
    const ch = supabase
      .channel('alertas-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'alertas_agente',
        filter: `tenant_id=eq.${tenant.id}`
      }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [tenant, load])

  async function reclassify() {
    setClassifying(true)
    await supabase.rpc('classify_alertas', { p_tenant_id: tenant.id })
    await load()
    setClassifying(false)
  }

  async function updateStatus(id, status) {
    setActionLoading(id)
    await supabase
      .from('alertas_agente')
      .update({
        status,
        ...(status === 'RESOLVIDO' ? { resolvido_em: new Date().toISOString() } : {})
      })
      .eq('id', id)
    setActionLoading(null)
    await load()
    if (expanded === id) setExpanded(null)
  }

  // Filtros aplicados
  const visíveis = alertas.filter(a =>
    (filtroPrio.length === 0 || filtroPrio.includes(a.prioridade)) &&
    (filtroTipo.length === 0 || filtroTipo.includes(a.tipo))
  )

  // Contagens por prioridade
  const counts = {}
  PRIOS.forEach(p => { counts[p] = alertas.filter(a => a.prioridade === p).length })

  // Agrupar por tipo para drill-down
  const porTipo = {}
  visíveis.forEach(a => {
    if (!porTipo[a.tipo]) porTipo[a.tipo] = []
    porTipo[a.tipo].push(a)
  })

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Alertas do Agente</h1>
          <p className="text-gray-500 text-sm mt-1">
            Pendências operacionais identificadas automaticamente
          </p>
        </div>
        <button
          onClick={reclassify}
          disabled={classifying}
          className="btn-primary shrink-0"
        >
          {classifying ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
            </svg>
          ) : '↻'}
          {classifying ? 'Classificando...' : 'Reclassificar'}
        </button>
      </div>

      {/* Tiles de contagem */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PRIOS.map(p => {
          const m = PRIO_META[p]
          const active = filtroPrio.includes(p)
          return (
            <button
              key={p}
              onClick={() => setFiltroPrio(prev =>
                prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
              )}
              className={`
                luma-card p-4 text-left transition-all duration-150 hover:border-luma-purple/30
                ${active ? `border-2 ${m.border}` : ''}
              `}
            >
              <div className={`text-3xl font-bold ${m.color} leading-none`}>{counts[p] ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1.5 uppercase tracking-wider font-medium">{m.label}</div>
              {active && <div className="text-[10px] text-luma-purplel mt-1">filtro ativo</div>}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">Status:</span>
        {['ABERTO','CIENTE','RESOLVIDO','SUPRIMIDO'].map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(prev =>
              prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
            )}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filtroStatus.includes(s)
                ? 'bg-luma-purple/20 border-luma-purple/40 text-luma-purplel'
                : 'border-[var(--luma-border)] text-gray-500 hover:text-gray-300'
            }`}
          >
            {s.toLowerCase()}
          </button>
        ))}
        <span className="text-xs text-gray-600 mx-1">|</span>
        <span className="text-xs text-gray-500 mr-1">Tipo:</span>
        {TIPOS.map(t => (
          <button
            key={t}
            onClick={() => setFiltroTipo(prev =>
              prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
            )}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filtroTipo.includes(t)
                ? 'bg-luma-purple/20 border-luma-purple/40 text-luma-purplel'
                : 'border-[var(--luma-border)] text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
        {(filtroPrio.length > 0 || filtroTipo.length > 0) && (
          <button
            onClick={() => { setFiltroPrio([]); setFiltroTipo([]) }}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-2"
          >
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="luma-card p-5 h-20 animate-pulse-soft" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : visíveis.length === 0 ? (
        <div className="luma-card p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-lg font-semibold text-gray-300">Nenhum alerta encontrado</div>
          <div className="text-sm text-gray-500 mt-1">
            {alertas.length === 0
              ? 'Clique em "Reclassificar" para executar uma varredura'
              : 'Ajuste os filtros para ver outros alertas'}
          </div>
        </div>
      ) : (
        /* Agrupado por tipo */
        <div className="space-y-6">
          {Object.entries(porTipo)
            .sort((a, b) => {
              const ordTipo = { ASO: 0, FERIAS: 1, CONTRATO: 2, CADASTRO: 3, OUTRO: 4 }
              return (ordTipo[a[0]] ?? 9) - (ordTipo[b[0]] ?? 9)
            })
            .map(([tipo, lista]) => (
              <div key={tipo} className="animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-300">{TIPO_LABEL[tipo] ?? tipo}</span>
                  <span className="text-xs text-gray-600">{lista.length} alerta{lista.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {lista.map(alerta => (
                    <AlertaCard
                      key={alerta.id}
                      alerta={alerta}
                      expanded={expanded === alerta.id}
                      onToggle={() => setExpanded(expanded === alerta.id ? null : alerta.id)}
                      onAction={updateStatus}
                      actionLoading={actionLoading === alerta.id}
                    />
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function AlertaCard({ alerta, expanded, onToggle, onAction, actionLoading }) {
  const m = PRIO_META[alerta.prioridade]

  return (
    <div className={`luma-card overflow-hidden transition-all duration-200 ${expanded ? `border-luma-purple/30` : 'hover:border-luma-purple/20'}`}>
      {/* Header — sempre visível */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-4 text-left"
      >
        {/* Dot prioridade */}
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.dot}`} />

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={m.badge}>{m.label}</span>
            {alerta.subtipo && (
              <span className="text-[10px] text-gray-600 uppercase tracking-wide">{alerta.subtipo}</span>
            )}
            <StatusChip status={alerta.status} />
          </div>
          <div className="text-sm font-semibold text-gray-100 mt-1.5 truncate">
            {alerta.titulo}
          </div>
          {alerta.colaboradores?.nome && (
            <div className="text-xs text-gray-500 mt-0.5">
              {alerta.colaboradores.nome}
              {alerta.colaboradores.cargo ? ` · ${alerta.colaboradores.cargo}` : ''}
              {alerta.colaboradores.tipo_vinculo ? ` · ${alerta.colaboradores.tipo_vinculo}` : ''}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-600 shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--luma-border)] px-4 py-4 space-y-4 animate-fade-in">
          {alerta.descricao && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Descrição</div>
              <p className="text-sm text-gray-300 leading-relaxed">{alerta.descricao}</p>
            </div>
          )}

          {alerta.base_legal && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Base Legal</div>
              <p className="text-sm text-gray-400 italic leading-relaxed">{alerta.base_legal}</p>
            </div>
          )}

          {alerta.acao_recomendada && (
            <div className="bg-luma-purple/8 border-l-2 border-luma-purple px-4 py-3 rounded-r-lg">
              <div className="text-[10px] text-luma-purplel uppercase tracking-wider mb-1 font-semibold">
                Ação recomendada
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{alerta.acao_recomendada}</p>
            </div>
          )}

          {/* Ações */}
          {['ABERTO','CIENTE'].includes(alerta.status) && (
            <div className="flex gap-2 pt-1">
              {alerta.status === 'ABERTO' && (
                <button
                  onClick={() => onAction(alerta.id, 'CIENTE')}
                  disabled={actionLoading}
                  className="btn-ghost text-xs border border-[var(--luma-border)] hover:border-luma-purple/30"
                >
                  {actionLoading ? '...' : '👁 Ciente'}
                </button>
              )}
              <button
                onClick={() => onAction(alerta.id, 'RESOLVIDO')}
                disabled={actionLoading}
                className="btn-ghost text-xs border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
              >
                {actionLoading ? '...' : '✓ Resolvido'}
              </button>
              <button
                onClick={() => onAction(alerta.id, 'SUPRIMIDO')}
                disabled={actionLoading}
                className="btn-danger text-xs"
              >
                {actionLoading ? '...' : '✕ Suprimir'}
              </button>
            </div>
          )}

          <div className="text-[10px] text-gray-600 pt-1">
            Criado em {new Date(alerta.criado_em).toLocaleDateString('pt-BR')}
            {alerta.resolvido_em && ` · Resolvido em ${new Date(alerta.resolvido_em).toLocaleDateString('pt-BR')}`}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    ABERTO:    'bg-blue-500/10 text-blue-400',
    CIENTE:    'bg-yellow-500/10 text-yellow-400',
    RESOLVIDO: 'bg-emerald-500/10 text-emerald-400',
    SUPRIMIDO: 'bg-gray-500/10 text-gray-500',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide ${map[status] ?? ''}`}>
      {status?.toLowerCase()}
    </span>
  )
}
