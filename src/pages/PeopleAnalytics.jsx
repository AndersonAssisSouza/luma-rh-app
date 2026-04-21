import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

function Card({ title, children }) {
  return (
    <div className="luma-card p-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">{title}</h3>
      {children}
    </div>
  )
}

function Bar({ label, value, max, color = 'bg-luma-purple' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-gray-400 truncate shrink-0">{label}</div>
      <div className="flex-1 bg-luma-dark2 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-6 text-xs text-gray-400 text-right shrink-0">{value}</div>
    </div>
  )
}

export default function PeopleAnalyticsPage() {
  const { tenant } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (tenant) load() }, [tenant])

  async function load() {
    setLoading(true)
    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('tipo_vinculo, status, area, data_admissao, cargo')
      .eq('tenant_id', tenant.id)

    if (!colabs) { setLoading(false); return }

    const ativos     = colabs.filter(c => c.status === 'ATIVO')
    const desligados = colabs.filter(c => c.status === 'DESLIGADO')

    // Por vínculo
    const porVinculo = {}
    ativos.forEach(c => { porVinculo[c.tipo_vinculo] = (porVinculo[c.tipo_vinculo] ?? 0) + 1 })

    // Por área
    const porArea = {}
    ativos.forEach(c => {
      const a = c.area ?? 'Não informada'
      porArea[a] = (porArea[a] ?? 0) + 1
    })

    // Admissões por ano
    const admPorAno = {}
    colabs.forEach(c => {
      if (!c.data_admissao) return
      const ano = c.data_admissao.slice(0,4)
      admPorAno[ano] = (admPorAno[ano] ?? 0) + 1
    })

    // Tempo médio de empresa
    const tempos = ativos
      .filter(c => c.data_admissao)
      .map(c => (new Date() - new Date(c.data_admissao + 'T12:00:00')) / (1000 * 60 * 60 * 24 * 365))
    const tempoMedio = tempos.length ? (tempos.reduce((a,b) => a+b, 0) / tempos.length).toFixed(1) : 0

    setData({ ativos: ativos.length, desligados: desligados.length, porVinculo, porArea, admPorAno, tempoMedio })
    setLoading(false)
  }

  if (loading) return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
      {[...Array(4)].map((_, i) => <div key={i} className="luma-card h-48 animate-pulse-soft" />)}
    </div>
  )

  if (!data) return null

  const maxVinculo = Math.max(...Object.values(data.porVinculo))
  const maxArea    = Math.max(...Object.values(data.porArea))
  const maxAdm     = Math.max(...Object.values(data.admPorAno))

  const VINCULO_COLORS = {
    CLT: 'bg-luma-purple', PJ: 'bg-yellow-400', ASSOCIADO: 'bg-emerald-400',
    ESTAGIARIO: 'bg-sky-400', SOCIO: 'bg-pink-400', MEI: 'bg-orange-400',
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">People Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Visão analítica do quadro de colaboradores</p>
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Headcount ativo', value: data.ativos, color: 'text-luma-purplel' },
          { label: 'Desligados (total)', value: data.desligados, color: 'text-gray-400' },
          { label: 'Tempo médio de empresa', value: `${data.tempoMedio}a`, color: 'text-luma-gold' },
          { label: 'Vínculos distintos', value: Object.keys(data.porVinculo).length, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="luma-card p-5">
            <div className={`text-3xl font-bold ${color} leading-none`}>{value}</div>
            <div className="text-xs text-gray-500 mt-2 leading-snug">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por vínculo */}
        <Card title="Distribuição por vínculo">
          <div className="space-y-3">
            {Object.entries(data.porVinculo)
              .sort((a,b) => b[1] - a[1])
              .map(([v, qtd]) => (
                <Bar key={v} label={v} value={qtd} max={maxVinculo}
                  color={VINCULO_COLORS[v] ?? 'bg-gray-500'} />
              ))}
          </div>
        </Card>

        {/* Por área */}
        <Card title="Distribuição por área">
          <div className="space-y-3">
            {Object.entries(data.porArea)
              .sort((a,b) => b[1] - a[1])
              .slice(0, 8)
              .map(([a, qtd]) => (
                <Bar key={a} label={a} value={qtd} max={maxArea} color="bg-luma-purplel" />
              ))}
          </div>
        </Card>

        {/* Admissões por ano */}
        <Card title="Admissões por ano">
          <div className="space-y-3">
            {Object.entries(data.admPorAno)
              .sort((a,b) => a[0].localeCompare(b[0]))
              .map(([ano, qtd]) => (
                <Bar key={ano} label={ano} value={qtd} max={maxAdm} color="bg-luma-gold" />
              ))}
          </div>
        </Card>

        {/* Turnover simples */}
        <Card title="Resumo geral">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-[var(--luma-border)]">
              <span className="text-sm text-gray-400">Total cadastrado</span>
              <span className="font-semibold text-white">{data.ativos + data.desligados}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--luma-border)]">
              <span className="text-sm text-gray-400">Ativos</span>
              <span className="font-semibold text-luma-purplel">{data.ativos}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--luma-border)]">
              <span className="text-sm text-gray-400">Desligados</span>
              <span className="font-semibold text-gray-400">{data.desligados}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-400">Taxa retenção (ativo/total)</span>
              <span className="font-semibold text-emerald-400">
                {data.ativos + data.desligados > 0
                  ? ((data.ativos / (data.ativos + data.desligados)) * 100).toFixed(0)
                  : 0}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
