import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

const VINCULOS = ['CLT', 'PJ', 'MEI', 'ASSOCIADO', 'ESTAGIARIO', 'SOCIO']
const AREAS    = ['Jurídico', 'Administrativo', 'Financeiro', 'Recursos Humanos', 'TI', 'Controladoria', 'Comercial', 'Diretoria', 'Outro']
const UFS      = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="luma-card p-6 space-y-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-[var(--luma-border)] pb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {children}
      </div>
    </div>
  )
}

const EMPTY = {
  nome: '', email_corporativo: '', email_pessoal: '', telefone: '',
  tipo_vinculo: 'CLT', cargo: '', area: '', gestor: '', gestor_email: '',
  data_admissao: '', data_nascimento: '', genero: '',
  cpf: '', rg: '', pis_pasep: '', ctps: '', matricula: '',
  salario_honorario: '', vale_refeicao: '', vale_transporte: '',
  plano_saude: '', outros_beneficios: '',
  cep: '', endereco: '', numero: '', bairro: '', cidade: '', uf: '',
  emergencia_nome: '', emergencia_telefone: '', emergencia_parentesco: '',
  banco: '', agencia: '', conta_bancaria: '', tipo_conta: '',
  jornada_trabalho: '', descricao_funcao: '',
  oab_numero: '', oab_uf: '',
}

export default function ColaboradorFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { tenant, isRH } = useAuthStore()

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit || !tenant) return
    supabase.from('colaboradores').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          const mapped = {}
          Object.keys(EMPTY).forEach(k => { mapped[k] = data[k] ?? '' })
          // formatar datas
          if (data.data_admissao) mapped.data_admissao = data.data_admissao
          if (data.data_nascimento) mapped.data_nascimento = data.data_nascimento
          setForm(mapped)
        }
        setLoading(false)
      })
  }, [id, isEdit, tenant])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isRH()) return setError('Sem permissão para salvar colaborador')
    setSaving(true)
    setError(null)

    const payload = { ...form, tenant_id: tenant.id }
    // limpar strings vazias para null em campos numéricos/data
    ;['salario_honorario','vale_refeicao','vale_transporte'].forEach(k => {
      if (payload[k] === '') payload[k] = null
      else if (payload[k]) payload[k] = parseFloat(payload[k])
    })
    ;['data_admissao','data_nascimento'].forEach(k => {
      if (payload[k] === '') payload[k] = null
    })

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('colaboradores').update(payload).eq('id', id))
    } else {
      ;({ error } = await supabase.from('colaboradores').insert(payload))
    }

    setSaving(false)
    if (error) return setError(error.message)
    navigate('/colaboradores')
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="text-gray-500 animate-pulse-soft">Carregando...</div>
    </div>
  )

  const inp = (k, extra = {}) => (
    <input value={form[k]} onChange={e => set(k, e.target.value)} className="luma-input" {...extra} />
  )
  const sel = (k, opts) => (
    <select value={form[k]} onChange={e => set(k, e.target.value)} className="luma-input">
      <option value="">Selecione...</option>
      {opts.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
    </select>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">← Voltar</button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Editar colaborador' : 'Novo colaborador'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <Section title="Identificação">
          <Field label="Nome completo" required>
            {inp('nome', { placeholder: 'Nome completo', required: true })}
          </Field>
          <Field label="Vínculo" required>
            {sel('tipo_vinculo', VINCULOS)}
          </Field>
          <Field label="Cargo">{inp('cargo', { placeholder: 'Ex: Advogado' })}</Field>
          <Field label="Área">{sel('area', AREAS)}</Field>
          <Field label="Data de admissão">{inp('data_admissao', { type: 'date' })}</Field>
          <Field label="Jornada de trabalho">{inp('jornada_trabalho', { placeholder: 'Ex: 44h semanais' })}</Field>
        </Section>

        {/* OAB — condicional para ASSOCIADO */}
        {form.tipo_vinculo === 'ASSOCIADO' && (
          <Section title="Registro OAB (obrigatório para Associado)">
            <Field label="Número OAB" required>
              {inp('oab_numero', { placeholder: 'Ex: 123456', required: true })}
            </Field>
            <Field label="UF OAB" required>
              {sel('oab_uf', UFS)}
            </Field>
          </Section>
        )}

        {/* Contato */}
        <Section title="Contato">
          <Field label="E-mail corporativo">{inp('email_corporativo', { type: 'email', placeholder: 'nome@empresa.com.br' })}</Field>
          <Field label="E-mail pessoal">{inp('email_pessoal', { type: 'email' })}</Field>
          <Field label="Telefone">{inp('telefone', { placeholder: '(31) 9 0000-0000' })}</Field>
          <Field label="Data de nascimento">{inp('data_nascimento', { type: 'date' })}</Field>
          <Field label="Gênero">
            {sel('genero', [
              { v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' },
              { v: 'NB', l: 'Não-binário' }, { v: 'NI', l: 'Prefiro não informar' }
            ])}
          </Field>
        </Section>

        {/* Documentos — somente CLT */}
        {['CLT','ESTAGIARIO'].includes(form.tipo_vinculo) && (
          <Section title="Documentos">
            <Field label="CPF">{inp('cpf', { placeholder: '000.000.000-00' })}</Field>
            <Field label="RG">{inp('rg')}</Field>
            <Field label="PIS/PASEP">{inp('pis_pasep')}</Field>
            <Field label="CTPS">{inp('ctps')}</Field>
            <Field label="Matrícula">{inp('matricula')}</Field>
          </Section>
        )}

        {/* Gestor */}
        <Section title="Gestão">
          <Field label="Gestor direto">{inp('gestor', { placeholder: 'Nome do gestor' })}</Field>
          <Field label="E-mail do gestor">{inp('gestor_email', { type: 'email' })}</Field>
          <div className="md:col-span-2">
            <Field label="Descrição da função">
              <textarea
                value={form.descricao_funcao}
                onChange={e => set('descricao_funcao', e.target.value)}
                className="luma-input resize-none"
                rows={3}
                placeholder="Principais responsabilidades..."
              />
            </Field>
          </div>
        </Section>

        {/* Remuneração */}
        <Section title="Remuneração e benefícios">
          <Field label="Salário / Honorário (R$)">{inp('salario_honorario', { type: 'number', min: 0, step: '0.01', placeholder: '0,00' })}</Field>
          <Field label="Vale refeição (R$)">{inp('vale_refeicao', { type: 'number', min: 0, step: '0.01', placeholder: '0,00' })}</Field>
          <Field label="Vale transporte (R$)">{inp('vale_transporte', { type: 'number', min: 0, step: '0.01', placeholder: '0,00' })}</Field>
          <Field label="Plano de saúde">{inp('plano_saude', { placeholder: 'Ex: Unimed' })}</Field>
          <div className="md:col-span-2">
            <Field label="Outros benefícios">{inp('outros_beneficios')}</Field>
          </div>
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <Field label="CEP">{inp('cep', { placeholder: '00000-000' })}</Field>
          <Field label="UF">{sel('uf', UFS)}</Field>
          <Field label="Cidade">{inp('cidade')}</Field>
          <Field label="Bairro">{inp('bairro')}</Field>
          <div className="md:col-span-2">
            <Field label="Logradouro">{inp('endereco')}</Field>
          </div>
          <Field label="Número">{inp('numero')}</Field>
        </Section>

        {/* Contato de emergência */}
        <Section title="Contato de emergência">
          <Field label="Nome">{inp('emergencia_nome')}</Field>
          <Field label="Telefone">{inp('emergencia_telefone')}</Field>
          <Field label="Parentesco">{inp('emergencia_parentesco')}</Field>
        </Section>

        {/* Dados bancários */}
        <Section title="Dados bancários">
          <Field label="Banco">{inp('banco', { placeholder: 'Ex: Nubank' })}</Field>
          <Field label="Agência">{inp('agencia')}</Field>
          <Field label="Conta">{inp('conta_bancaria')}</Field>
          <Field label="Tipo de conta">
            {sel('tipo_conta', [
              { v: 'CC', l: 'Conta Corrente' }, { v: 'CP', l: 'Conta Poupança' },
              { v: 'CI', l: 'Conta de Investimento' }
            ])}
          </Field>
        </Section>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost border border-[var(--luma-border)]">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar colaborador'}
          </button>
        </div>
      </form>
    </div>
  )
}
