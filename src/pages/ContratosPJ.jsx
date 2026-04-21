import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const TIPO_COLORS = {
  PJ:            'bg-yellow-500/20 text-yellow-400',
  MEI:           'bg-orange-500/20 text-orange-400',
  ASSOCIACAO_OAB:'bg-emerald-500/20 text-emerald-400',
  ESTAGIO:       'bg-sky-500/20 text-sky-400',
  SOCIO:         'bg-pink-500/20 text-pink-400',
  CLT:           'bg-luma-purple/20 text-luma-purplel',
}

export default function ContratosPJPage() {
  const { tenant } = useAuthStore()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('ATIVO')

  useEffect(() => { if (tenant) load() }, [tenant, filtro])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('contratos')
      .select(`id, tipo_contrato, data_inicio, data_fim, prazo_indeterminado,
               status_contrato, renovacao_automatica, registro_oab, observacao,
               colaboradores ( nome, cargo, oab_numero, oab_uf )`)
      .eq('tenant_id', tenant.id)
      .eq('status_contrato', filtro)
      .order('data_fim', { nullsFirst: true })
    setData(rows ?? [])
    setLoading(false)
  }

  function diasAte(d) {
    if (!d) return null
    return Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 86400000)
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contratos</h1>
          <p className="text-gray-500 text-sm mt-1">PJ · MEI · Associação OAB · Estágio · Sócio</p>
        </div>
        <div className="flex rounded-lg border border-[var(--luma-border)] overflow-hidden">
          {[['ATIVO','Ativos'],['ENCERRADO','Encerrados'],['SUSPENSO','Suspensos']].map(([v,l]) => (
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
              <th>Início</th>
              <th>Fim / Vencimento</th>
              <th>OAB</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j}><div className="h-4 bg-luma-dark2 rounded animate-pulse-soft" /></td>)}</tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">Nenhum contrato encontrado</td></tr>
            ) : (
              data.map(r => {
                const dias = diasAte(r.data_fim)
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium text-gray-200">{r.colaboradores?.nome ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.colaboradores?.cargo ?? ''}</div>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${TIPO_COLORS[r.tipo_contrato] ?? 'bg-gray-500/20 text-gray-400'}`}>
                        {r.tipo_contrato}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-400">
                      {r.data_inicio ? new Date(r.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="font-mono text-xs">
                      {r.prazo_indeterminado ? (
                        <span className="text-gray-500">Indeterminado</span>
                      ) : r.data_fim ? (
                        <div>
                          <div>{new Date(r.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                          {dias !== null && filtro === 'ATIVO' && (
                            <div className={`text-[10px] mt-0.5 ${dias < 0 ? 'text-red-400' : dias <= 30 ? 'text-orange-400' : dias <= 60 ? 'text-yellow-400' : 'text-gray-500'}`}>
                              {dias < 0 ? `vencido há ${Math.abs(dias)}d` : `em ${dias}d`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-yellow-400 text-[10px]">⚠ Sem data_fim</span>
                      )}
                    </td>
                    <td className="text-xs">
                      {r.tipo_contrato === 'ASSOCIACAO_OAB' ? (
                        r.colaboradores?.oab_numero ? (
                          <span className="text-emerald-400 font-mono">
                            {r.colaboradores.oab_numero}/{r.colaboradores.oab_uf}
                          </span>
                        ) : (
                          <span className="text-red-400">⚠ Sem OAB</span>
                        )
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td>
                      {filtro !== 'ATIVO' ? (
                        <span className="text-xs text-gray-500">{r.status_contrato}</span>
                      ) : !r.data_fim && !r.prazo_indeterminado ? (
                        <span className="badge-atencao">Sem prazo</span>
                      ) : dias !== null && dias < 0 ? (
                        <span className="badge-critico">Vencido</span>
                      ) : dias !== null && dias <= 30 ? (
                        <span className="badge-alta">Vence em breve</span>
                      ) : dias !== null && dias <= 60 ? (
                        <span className="badge-atencao">Atenção</span>
                      ) : (
                        <span className="badge-acomp">Regular</span>
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
