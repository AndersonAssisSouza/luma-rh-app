import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

function diasEntre(ini, fim) {
  if (!ini || !fim) return 0
  return Math.ceil((new Date(fim + 'T12:00:00') - new Date(ini + 'T12:00:00')) / 86400000) + 1
}

export default function SolicitarFeriasPage() {
  const { profile, tenant } = useAuthStore()
  const [colaborador, setColaborador] = useState(null)
  const [saldo, setSaldo]             = useState(null)
  const [historico, setHistorico]     = useState([])
  const [form, setForm] = useState({ data_inicio: '', data_fim: '', observacao: '' })
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(null)
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!profile) return
    loadDados()
  }, [profile])

  async function loadDados() {
    setLoading(true)
    // buscar colaborador pelo email do profile
    const { data: colab } = await supabase
      .from('colaboradores')
      .select('id, nome, cargo, tipo_vinculo, data_admissao')
      .eq('email_corporativo', profile.email)
      .eq('status', 'ATIVO')
      .single()

    if (!colab) { setLoading(false); return }
    setColaborador(colab)

    // saldo de férias
    const { data: saldoData } = await supabase
      .from('ferias_saldo')
      .select('*')
      .eq('colaborador_id', colab.id)
      .order('fim_periodo_aquisitivo', { ascending: false })
      .limit(1)
      .single()
    setSaldo(saldoData)

    // histórico de solicitações
    const { data: hist } = await supabase
      .from('solicitacoes_ferias')
      .select('*')
      .eq('colaborador_id', colab.id)
      .order('solicitado_em', { ascending: false })
      .limit(10)
    setHistorico(hist ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const { data, error: err } = await supabase.rpc('solicitar_ferias', {
      p_colaborador_id: colaborador.id,
      p_data_inicio:    form.data_inicio,
      p_data_fim:       form.data_fim,
      p_observacao:     form.observacao || null,
    })

    setSubmitting(false)
    if (err) return setError(err.message)
    setSuccess('Solicitação enviada! Aguarde aprovação do RH.')
    setForm({ data_inicio: '', data_fim: '', observacao: '' })
    loadDados()
  }

  const dias = diasEntre(form.data_inicio, form.data_fim)

  if (loading) return (
    <div className="p-8 flex items-center justify-center text-gray-500 animate-pulse-soft">
      Carregando...
    </div>
  )

  if (!colaborador) return (
    <div className="p-8 max-w-xl mx-auto text-center">
      <div className="luma-card p-10">
        <div className="text-4xl mb-4">👤</div>
        <h2 className="text-lg font-semibold text-gray-300">Cadastro não encontrado</h2>
        <p className="text-sm text-gray-500 mt-2">
          Seu e-mail ({profile?.email}) não está vinculado a nenhum colaborador ativo.
          Entre em contato com o RH.
        </p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Solicitar Férias</h1>
        <p className="text-gray-500 text-sm mt-1">{colaborador.nome} · {colaborador.cargo ?? ''}</p>
      </div>

      {/* Saldo */}
      {saldo && (
        <div className="luma-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Período Aquisitivo', value: saldo.fim_periodo_aquisitivo
                ? new Date(saldo.fim_periodo_aquisitivo + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
            { label: 'Fim Concessivo', value: saldo.fim_periodo_concessivo
                ? new Date(saldo.fim_periodo_concessivo + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
            { label: 'Status', value: saldo.status_ferias ?? '—' },
            { label: 'Programadas', value: saldo.ferias_programadas_inicio
                ? new Date(saldo.ferias_programadas_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nenhuma' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-sm text-gray-200 font-medium">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário */}
      {colaborador.tipo_vinculo === 'CLT' ? (
        <div className="luma-card p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
            Nova solicitação
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Início</label>
                <input
                  type="date"
                  value={form.data_inicio}
                  onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="luma-input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Fim</label>
                <input
                  type="date"
                  value={form.data_fim}
                  onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                  min={form.data_inicio || new Date().toISOString().split('T')[0]}
                  required
                  className="luma-input"
                />
              </div>
            </div>

            {dias > 0 && (
              <div className={`text-sm font-medium px-4 py-2 rounded-lg ${
                dias < 5 ? 'bg-red-500/10 text-red-400' :
                dias > 30 ? 'bg-orange-500/10 text-orange-400' :
                'bg-luma-purple/10 text-luma-purplel'
              }`}>
                {dias} dias corridos
                {dias < 5 && ' — mínimo 5 dias'}
                {dias > 30 && ' — máximo 30 dias por solicitação'}
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Observação</label>
              <textarea
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                className="luma-input resize-none"
                rows={2}
                placeholder="Opcional: informações adicionais..."
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm text-emerald-400">
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || dias < 5 || dias > 30}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </form>
        </div>
      ) : (
        <div className="luma-card p-8 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-gray-400 text-sm">
            Férias CLT disponíveis apenas para colaboradores com vínculo CLT.<br/>
            Vínculo atual: <span className="text-luma-purplel font-medium">{colaborador.tipo_vinculo}</span>
          </p>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="luma-card p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Histórico de solicitações
          </h2>
          <div className="space-y-2">
            {historico.map(s => (
              <div key={s.id} className="flex items-center gap-4 py-2.5 border-b border-[var(--luma-border)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 font-medium font-mono">{s.protocolo}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(s.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {' – '}
                    {new Date(s.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {' · '}{s.dias_corridos} dias
                  </div>
                </div>
                <StatusSol status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusSol({ status }) {
  const map = {
    PENDENTE:  'badge-atencao',
    APROVADO:  'badge-acomp',
    REJEITADO: 'badge-critico',
  }
  return <span className={map[status] ?? 'badge-acomp'}>{status?.toLowerCase()}</span>
}
