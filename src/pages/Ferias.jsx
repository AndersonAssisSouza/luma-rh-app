import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

function diasAte(date) {
  if (!date) return null
  const diff = Math.ceil((new Date(date + 'T12:00:00') - new Date()) / 86400000)
  return diff
}

function StatusBadge({ status, diasConcessivo }) {
  if (!status || status === 'NAO_PROGRAMADA') {
    if (diasConcessivo !== null && diasConcessivo < 0)
      return <span className="badge-critico">Vencida</span>
    if (diasConcessivo !== null && diasConcessivo <= 60)
      return <span className="badge-alta">Urgente</span>
    if (diasConcessivo !== null && diasConcessivo <= 120)
      return <span className="badge-atencao">Atenção</span>
    return <span className="text-xs text-gray-500">Não programada</span>
  }
  if (status === 'PROGRAMADA') return <span className="badge-acomp">Programada</span>
  if (status === 'GOZADA') return <span className="text-xs text-emerald-400">Gozada</span>
  return <span className="text-xs text-gray-400">{status}</span>
}

export default function FeriasPage() {
  const { tenant } = useAuthStore()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('pendentes') // pendentes | todos

  useEffect(() => {
    if (!tenant) return
    load()
  }, [tenant])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('ferias_saldo')
      .select(`
        id, inicio_periodo_aquisitivo, fim_periodo_aquisitivo,
        fim_periodo_concessivo, ferias_programadas_inicio, ferias_programadas_fim,
        ferias_gozadas_inicio, ferias_gozadas_fim, status_ferias,
        colaboradores ( id, nome, cargo, tipo_vinculo, status )
      `)
      .eq('tenant_id', tenant.id)
      .eq('colaboradores.tipo_vinculo', 'CLT')
    setData((rows ?? []).filter(r => r.colaboradores?.tipo_vinculo === 'CLT'))
    setLoading(false)
  }

  const filtered = data
    .filter(r => {
      if (filtro === 'todos') return true
      const d = diasAte(r.fim_periodo_concessivo)
      const gozada = !!r.ferias_gozadas_fim
      return !gozada && (d === null || d <= 120)
    })
    .sort((a, b) => {
      const da = diasAte(a.fim_periodo_concessivo) ?? 9999
      const db = diasAte(b.fim_periodo_concessivo) ?? 9999
      return da - db
    })

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Controle de Férias</h1>
          <p className="text-gray-500 text-sm mt-1">Apenas colaboradores CLT</p>
        </div>
        <div className="flex rounded-lg border border-[var(--luma-border)] overflow-hidden">
          {[['pendentes','Pendentes'],['todos','Todos']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${filtro === v ? 'bg-luma-purple text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="luma-card overflow-hidden">
        <table className="luma-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Período Aquisitivo</th>
              <th>Fim Concessivo</th>
              <th>Dias Restantes</th>
              <th>Situação</th>
              <th>Férias Programadas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j}><div className="h-4 bg-luma-dark2 rounded animate-pulse-soft" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">Nenhum registro encontrado</td></tr>
            ) : (
              filtered.map(r => {
                const dias = diasAte(r.fim_periodo_concessivo)
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-gray-200">{r.colaboradores?.nome ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.colaboradores?.cargo ?? ''}</div>
                    </td>
                    <td className="font-mono text-xs">
                      {r.inicio_periodo_aquisitivo ? new Date(r.inicio_periodo_aquisitivo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      {' – '}
                      {r.fim_periodo_aquisitivo ? new Date(r.fim_periodo_aquisitivo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="font-mono text-xs">
                      {r.fim_periodo_concessivo ? new Date(r.fim_periodo_concessivo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>
                      {dias === null ? '—' : (
                        <span className={`font-bold text-sm ${dias < 0 ? 'text-red-400' : dias <= 30 ? 'text-orange-400' : dias <= 60 ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {dias < 0 ? `${Math.abs(dias)}d vencido` : `${dias}d`}
                        </span>
                      )}
                    </td>
                    <td><StatusBadge status={r.status_ferias} diasConcessivo={dias} /></td>
                    <td className="font-mono text-xs text-gray-400">
                      {r.ferias_programadas_inicio
                        ? `${new Date(r.ferias_programadas_inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(r.ferias_programadas_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                        : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
