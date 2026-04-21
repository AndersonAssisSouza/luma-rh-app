import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function ExamesPage() {
  const { tenant } = useAuthStore()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('atencao')

  useEffect(() => { if (tenant) load() }, [tenant])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('exames_ocupacionais')
      .select(`id, tipo_exame, ultimo_exame, proximo_exame, status_exame, observacao,
               colaboradores ( nome, cargo, tipo_vinculo )`)
      .eq('tenant_id', tenant.id)
    setData(rows ?? [])
    setLoading(false)
  }

  const hoje = new Date()

  function diasAte(d) {
    if (!d) return null
    return Math.ceil((new Date(d + 'T12:00:00') - hoje) / 86400000)
  }

  const filtered = data
    .filter(r => {
      if (filtro === 'todos') return true
      const d = diasAte(r.proximo_exame)
      if (!r.proximo_exame) return true // sem registro
      return d !== null && d <= 60
    })
    .sort((a, b) => {
      const da = diasAte(a.proximo_exame) ?? -9999
      const db = diasAte(b.proximo_exame) ?? -9999
      return da - db
    })

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exames Ocupacionais</h1>
          <p className="text-gray-500 text-sm mt-1">ASO / PCMSO — NR-7</p>
        </div>
        <div className="flex rounded-lg border border-[var(--luma-border)] overflow-hidden">
          {[['atencao','Atenção'],['todos','Todos']].map(([v,l]) => (
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
              <th>Tipo</th>
              <th>Último Exame</th>
              <th>Próximo Exame</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(5)].map((_, j) => <td key={j}><div className="h-4 bg-luma-dark2 rounded animate-pulse-soft" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-500">Nenhum exame com pendência</td></tr>
            ) : (
              filtered.map(r => {
                const dias = diasAte(r.proximo_exame)
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-gray-200">{r.colaboradores?.nome ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.colaboradores?.cargo ?? ''}</div>
                    </td>
                    <td className="text-gray-400 text-xs">{r.tipo_exame ?? 'Periódico'}</td>
                    <td className="font-mono text-xs text-gray-400">
                      {r.ultimo_exame ? new Date(r.ultimo_exame + 'T12:00:00').toLocaleDateString('pt-BR') : <span className="text-red-400">Sem registro</span>}
                    </td>
                    <td className="font-mono text-xs">
                      {r.proximo_exame ? new Date(r.proximo_exame + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>
                      {!r.proximo_exame ? (
                        <span className="badge-critico">Sem ASO</span>
                      ) : dias < 0 ? (
                        <span className="badge-critico">Vencido {Math.abs(dias)}d</span>
                      ) : dias <= 30 ? (
                        <span className="badge-alta">Vence em {dias}d</span>
                      ) : dias <= 60 ? (
                        <span className="badge-atencao">Vence em {dias}d</span>
                      ) : (
                        <span className="badge-acomp">Em dia</span>
                      )}
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
