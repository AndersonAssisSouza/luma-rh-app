import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const VINCULO_COLORS = {
  CLT:        'bg-luma-purple/20 text-luma-purplel',
  PJ:         'bg-yellow-500/20 text-yellow-400',
  ASSOCIADO:  'bg-emerald-500/20 text-emerald-400',
  ESTAGIARIO: 'bg-sky-500/20 text-sky-400',
  SOCIO:      'bg-pink-500/20 text-pink-400',
  MEI:        'bg-orange-500/20 text-orange-400',
}

export default function ColaboradoresPage() {
  const { tenant, isRH } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filtroVinculo, setFiltroVinculo] = useState('')
  const [filtroStatus, setFiltroStatus]   = useState('ATIVO')
  const [sort, setSort] = useState({ col: 'nome', dir: 'asc' })

  useEffect(() => {
    if (!tenant) return
    load()
  }, [tenant, filtroStatus])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('colaboradores')
      .select('id, id_colaborador, nome, tipo_vinculo, cargo, area, gestor, status, data_admissao, email_corporativo')
      .eq('tenant_id', tenant.id)
      .eq('status', filtroStatus)
      .order('nome')
    setData(rows ?? [])
    setLoading(false)
  }

  const filtered = data
    .filter(c =>
      (!search || c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.email_corporativo?.toLowerCase().includes(search.toLowerCase())) &&
      (!filtroVinculo || c.tipo_vinculo === filtroVinculo)
    )
    .sort((a, b) => {
      const av = a[sort.col] ?? ''
      const bv = b[sort.col] ?? ''
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const vinculos = [...new Set(data.map(c => c.tipo_vinculo).filter(Boolean))]

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Colaboradores</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {isRH() && (
          <button onClick={() => navigate('/colaboradores/novo')} className="btn-primary">
            + Novo colaborador
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="luma-input w-72"
        />
        <select
          value={filtroVinculo}
          onChange={e => setFiltroVinculo(e.target.value)}
          className="luma-input w-44"
        >
          <option value="">Todos os vínculos</option>
          {vinculos.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="flex rounded-lg border border-[var(--luma-border)] overflow-hidden">
          {['ATIVO','DESLIGADO','AFASTADO'].map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                filtroStatus === s
                  ? 'bg-luma-purple text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="luma-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="luma-table">
            <thead>
              <tr>
                {[
                  { col: 'id_colaborador', label: 'ID' },
                  { col: 'nome', label: 'Nome' },
                  { col: 'tipo_vinculo', label: 'Vínculo' },
                  { col: 'cargo', label: 'Cargo' },
                  { col: 'area', label: 'Área' },
                  { col: 'data_admissao', label: 'Admissão' },
                ].map(({ col, label }) => (
                  <th key={col} onClick={() => toggleSort(col)} className="cursor-pointer select-none hover:text-gray-300">
                    <span className="flex items-center gap-1">
                      {label}
                      {sort.col === col && (
                        <span className="text-luma-purplel">{sort.dir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j}><div className="h-4 bg-luma-dark2 rounded animate-pulse-soft" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">Nenhum colaborador encontrado</td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} onClick={() => isRH() && navigate(`/colaboradores/${c.id}`)}
                    className={isRH() ? 'cursor-pointer' : ''}>
                    <td className="font-mono text-xs text-gray-500">{c.id_colaborador}</td>
                    <td>
                      <div className="font-medium text-gray-200">{c.nome}</div>
                      {c.email_corporativo && (
                        <div className="text-xs text-gray-500">{c.email_corporativo}</div>
                      )}
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${VINCULO_COLORS[c.tipo_vinculo] ?? 'bg-gray-500/20 text-gray-400'}`}>
                        {c.tipo_vinculo}
                      </span>
                    </td>
                    <td className="text-gray-400">{c.cargo ?? '—'}</td>
                    <td className="text-gray-400">{c.area ?? '—'}</td>
                    <td className="text-gray-400 font-mono text-xs">
                      {c.data_admissao
                        ? new Date(c.data_admissao + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
