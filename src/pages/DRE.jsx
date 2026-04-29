import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { exportDREToExcel, periodoFilename } from '@/lib/exportDRE'

// ─── Estrutura de linhas da DRE ───────────────────────────────────────────────
const DRE_LINHAS = [
  { id: 'h_custo',    label: 'CUSTOS COM PESSOAL',                      tipo: 'header',   indent: 0 },
  { id: 'g_rem',      label: 'Remuneração',                              tipo: 'group',    indent: 1 },
  { id: 'sal_clt',    label: 'Salários (CLT)',                           tipo: 'item',     indent: 2 },
  { id: 'hon_pj',     label: 'Honorários (PJ / MEI / Assoc. / Sócio)',   tipo: 'item',     indent: 2 },
  { id: 'sal_outros', label: 'Estágio e demais',                         tipo: 'item',     indent: 2 },
  { id: 'sub_rem',    label: 'Subtotal Remuneração',                     tipo: 'subtotal', indent: 1 },
  { id: 'g_ben',      label: 'Benefícios',                               tipo: 'group',    indent: 1 },
  { id: 'vr',         label: 'Vale Refeição',                            tipo: 'item',     indent: 2 },
  { id: 'vt',         label: 'Vale Transporte',                          tipo: 'item',     indent: 2 },
  { id: 'sub_ben',    label: 'Subtotal Benefícios',                      tipo: 'subtotal', indent: 1 },
  { id: 'g_enc',      label: 'Encargos Legais (CLT)',                    tipo: 'group',    indent: 1 },
  { id: 'inss',       label: 'INSS Patronal (20%)',                      tipo: 'item',     indent: 2 },
  { id: 'fgts',       label: 'FGTS (8%)',                                tipo: 'item',     indent: 2 },
  { id: 'dec13',      label: 'Provisão 13º Salário (8,33%)',             tipo: 'item',     indent: 2 },
  { id: 'fer_prov',   label: 'Provisão Férias + 1/3 (11,11%)',           tipo: 'item',     indent: 2 },
  { id: 'sub_enc',    label: 'Subtotal Encargos',                        tipo: 'subtotal', indent: 1 },
  { id: 'total',      label: 'TOTAL CUSTO COM PESSOAL',                  tipo: 'total',    indent: 0 },
  { id: '_sp',        label: '',                                          tipo: 'spacer',   indent: 0 },
  { id: 'h_hc',       label: 'HEADCOUNT',                                tipo: 'header',   indent: 0 },
  { id: 'hc_ativo',   label: 'Headcount Ativo',                          tipo: 'item',     indent: 1, fmt: 'int' },
  { id: 'hc_adm',     label: 'Admissões no Período',                     tipo: 'item',     indent: 1, fmt: 'int' },
  { id: 'custo_medio',label: 'Custo Médio por Colaborador',              tipo: 'item',     indent: 1 },
]

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computePeriodos(janela) {
  const now = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  if (janela === 'mes') return [{ ano: curYear, mes: curMonth }]

  if (janela === 'ano') {
    return Array.from({ length: curMonth }, (_, i) => ({ ano: curYear, mes: i + 1 }))
  }

  const n = parseInt(janela, 10)
  return Array.from({ length: n }, (_, i) => {
    let mes = curMonth - (n - 1 - i)
    let ano = curYear
    while (mes <= 0) { mes += 12; ano-- }
    return { ano, mes }
  })
}

function calcPeriodo(colaboradores, { ano, mes }) {
  const fimMes    = new Date(ano, mes, 0)
  const inicioMes = new Date(ano, mes - 1, 1)

  const ativos = colaboradores.filter(c => {
    if (!c.data_admissao || c.status !== 'ATIVO') return false
    return new Date(c.data_admissao + 'T12:00:00') <= fimMes
  })

  const clt    = ativos.filter(c => c.tipo_vinculo === 'CLT')
  const pjGrp  = ativos.filter(c => ['PJ','MEI','ASSOCIADO','SOCIO'].includes(c.tipo_vinculo))
  const outros = ativos.filter(c => !['CLT','PJ','MEI','ASSOCIADO','SOCIO'].includes(c.tipo_vinculo))

  const admissoes = colaboradores.filter(c => {
    if (!c.data_admissao) return false
    const d = new Date(c.data_admissao + 'T12:00:00')
    return d >= inicioMes && d <= fimMes
  })

  const sum = (arr, f) => arr.reduce((s, c) => s + (parseFloat(c[f]) || 0), 0)

  const sal_clt    = sum(clt, 'salario_honorario')
  const hon_pj     = sum(pjGrp, 'salario_honorario')
  const sal_outros = sum(outros, 'salario_honorario')
  const sub_rem    = sal_clt + hon_pj + sal_outros

  const vr      = sum(ativos, 'vale_refeicao')
  const vt      = sum(ativos, 'vale_transporte')
  const sub_ben = vr + vt

  const inss     = sal_clt * 0.20
  const fgts     = sal_clt * 0.08
  const dec13    = sal_clt * 0.0833
  const fer_prov = sal_clt * 0.1111
  const sub_enc  = inss + fgts + dec13 + fer_prov

  const total      = sub_rem + sub_ben + sub_enc
  const hc_ativo   = ativos.length
  const hc_adm     = admissoes.length
  const custo_medio = hc_ativo > 0 ? total / hc_ativo : 0

  return {
    sal_clt, hon_pj, sal_outros, sub_rem,
    vr, vt, sub_ben,
    inss, fgts, dec13, fer_prov, sub_enc,
    total,
    hc_ativo, hc_adm, custo_medio,
  }
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function formatVal(val, linha) {
  if (val === null || val === undefined) return null
  return linha.fmt === 'int' ? fmtInt.format(val) : fmtBRL.format(val)
}

// ─── Ícones inline (mesma aparência do lucide-react) ──────────────────────────
function IcoPrinter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}

function IcoSpreadsheet() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
      <line x1="8" y1="9" x2="10" y2="9"/>
    </svg>
  )
}

// ─── Estilos por tipo de linha ────────────────────────────────────────────────
const ROW_BG = {
  header:   'bg-luma-ink2',
  group:    'bg-luma-dark1',
  subtotal: 'bg-luma-dark2/60',
  total:    'bg-luma-purple/20',
  item:     '',
  spacer:   '',
}

const LABEL_CLS = {
  header:   'font-bold text-white text-[11px] uppercase tracking-widest',
  group:    'font-semibold text-purple-300 text-sm',
  subtotal: 'font-semibold text-gray-200 text-sm',
  total:    'font-bold text-white text-sm uppercase tracking-wide',
  item:     'text-gray-400 text-sm',
  spacer:   '',
}

const VAL_CLS = {
  header:   '',
  group:    '',
  subtotal: 'font-semibold text-gray-200 tabular-nums',
  total:    'font-bold text-luma-purplel tabular-nums',
  item:     'text-gray-300 tabular-nums',
  spacer:   '',
}

const INDENT_PL = { 0: 'pl-4', 1: 'pl-8', 2: 'pl-14' }

const BORDER_T = {
  header:   'border-t border-[var(--luma-border)]',
  group:    '',
  subtotal: 'border-t border-[var(--luma-border)]',
  total:    'border-y-2 border-luma-purple',
  item:     '',
  spacer:   '',
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DREPage() {
  const { tenant } = useAuthStore()
  const [colaboradores, setColaboradores] = useState([])
  const [loading, setLoading]   = useState(true)
  const [janela, setJanela]     = useState('6')
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (tenant) load() }, [tenant])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('colaboradores')
      .select('tipo_vinculo, status, data_admissao, salario_honorario, vale_refeicao, vale_transporte')
      .eq('tenant_id', tenant.id)
    setColaboradores(data ?? [])
    setLoading(false)
  }

  const periodos = useMemo(() => computePeriodos(janela), [janela])

  const dadosPorPeriodo = useMemo(() => {
    const r = {}
    for (const p of periodos) r[`${p.ano}-${p.mes}`] = calcPeriodo(colaboradores, p)
    return r
  }, [colaboradores, periodos])

  function getValor(linha, p) {
    if (['header','group','spacer'].includes(linha.tipo)) return null
    return dadosPorPeriodo[`${p.ano}-${p.mes}`]?.[linha.id] ?? null
  }

  function getTotal(linha) {
    if (['header','group','spacer'].includes(linha.tipo)) return null
    if (linha.id === 'hc_ativo') {
      const last = periodos[periodos.length - 1]
      return dadosPorPeriodo[`${last.ano}-${last.mes}`]?.hc_ativo ?? null
    }
    if (linha.id === 'custo_medio') {
      const vals = periodos
        .map(p => dadosPorPeriodo[`${p.ano}-${p.mes}`]?.custo_medio)
        .filter(v => v != null && v > 0)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    return periodos.reduce(
      (sum, p) => sum + (dadosPorPeriodo[`${p.ano}-${p.mes}`]?.[linha.id] ?? 0),
      0,
    )
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportDREToExcel({
        linhas: DRE_LINHAS,
        periodos,
        dadosPorPeriodo,
        empresa: tenant?.nome,
      })
    } finally {
      setExporting(false)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-9 bg-luma-dark1 rounded animate-pulse-soft" />
        ))}
      </div>
    )
  }

  const numCols = periodos.length + 2  // desc + N periodos + total

  return (
    <div className="p-6 space-y-5 animate-fade-in" id="dre-print-root">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">DRE</h1>
          <p className="text-gray-500 text-sm mt-1">Demonstrativo de Resultado com Pessoal</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          <select
            value={janela}
            onChange={e => setJanela(e.target.value)}
            className="luma-input py-2 text-sm w-auto"
          >
            <option value="mes">Mês atual</option>
            <option value="3">Últimos 3 meses</option>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
            <option value="ano">Este ano</option>
          </select>

          <button
            onClick={() => window.print()}
            className="btn-ghost border border-[var(--luma-border)]"
          >
            <IcoPrinter />
            Imprimir
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-ghost border border-[var(--luma-border)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <IcoSpreadsheet />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* ── Tabela DRE ─────────────────────────────────────────────────────── */}
      <div className="luma-card overflow-x-auto">
        <table className="w-full border-collapse text-sm">

          <thead>
            <tr className="bg-luma-purple/25">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-white uppercase tracking-wider min-w-[260px] sticky left-0 bg-luma-ink2">
                Descrição
              </th>
              {periodos.map(p => (
                <th
                  key={`${p.ano}-${p.mes}`}
                  className="text-right px-4 py-2.5 text-[11px] font-semibold text-white uppercase tracking-wider min-w-[130px] whitespace-nowrap"
                >
                  {MESES[p.mes - 1]}/{String(p.ano).slice(2)}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-luma-gold uppercase tracking-wider min-w-[140px] whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {DRE_LINHAS.map(linha => {
              if (linha.tipo === 'spacer') {
                return (
                  <tr key={linha.id}>
                    <td colSpan={numCols} className="h-3 bg-luma-ink" />
                  </tr>
                )
              }

              const hasVal = ['item','subtotal','total'].includes(linha.tipo)

              return (
                <tr
                  key={linha.id}
                  className={[
                    ROW_BG[linha.tipo],
                    BORDER_T[linha.tipo],
                    linha.tipo === 'item' ? 'hover:bg-luma-dark1/50 transition-colors' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {/* Label */}
                  <td
                    className={[
                      'px-4 py-2',
                      INDENT_PL[linha.indent] ?? 'pl-4',
                      LABEL_CLS[linha.tipo],
                    ].join(' ')}
                  >
                    {linha.tipo === 'group' ? `▸ ${linha.label}` : linha.label}
                  </td>

                  {/* Period values */}
                  {periodos.map(p => {
                    const val = getValor(linha, p)
                    const fmt = formatVal(val, linha)
                    const neg = val !== null && val < 0
                    return (
                      <td
                        key={`${p.ano}-${p.mes}`}
                        className={[
                          'px-4 py-2 text-right',
                          VAL_CLS[linha.tipo],
                          hasVal && neg ? 'text-red-400' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {hasVal ? (fmt ?? '—') : ''}
                      </td>
                    )
                  })}

                  {/* Total column */}
                  {(() => {
                    const val = getTotal(linha)
                    const fmt = formatVal(val, linha)
                    const neg = val !== null && val < 0
                    return (
                      <td
                        className={[
                          'px-4 py-2 text-right',
                          linha.tipo === 'total'
                            ? 'font-bold text-luma-purplel tabular-nums'
                            : VAL_CLS[linha.tipo],
                          hasVal && neg ? 'text-red-400' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {hasVal ? (fmt ?? '—') : ''}
                      </td>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Nota de rodapé ─────────────────────────────────────────────────── */}
      <p className="text-[11px] text-gray-600 no-print">
        * Encargos CLT calculados sobre salário bruto: INSS Patronal 20%, FGTS 8%, Provisão 13º 8,33%, Provisão Férias + 1/3 11,11%.
        Baseado nos dados cadastrais dos colaboradores com status Ativo.
      </p>
    </div>
  )
}
