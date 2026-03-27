// ============================================================
// LUMA RH — Supabase Client (módulo compartilhado)
// Importar em todos os arquivos HTML via:
//   <script type="module" src="./supabase_client.js"></script>
//   ou import { sb, getProfile, ... } from './supabase_client.js'
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ⚠️ PREENCHER com as credenciais do seu projeto Supabase
// Project Settings → API → Project URL e anon/public key
export const SUPABASE_URL  = 'https://ttclcdppifmmdjztfunl.supabase.co'
export const SUPABASE_KEY  = 'sb_publishable_BBLkzcH2J9Rjxz5ENu1xYg_70Sm_obs'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,        // necessário para link de recuperação de senha
    storage: window.localStorage
  }
})

// ============================================================
// AUTH
// ============================================================

/** Login com email e senha */
export async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/** Logout */
export async function logout() {
  await sb.auth.signOut()
  window.location.href = './login.html'
}

/** Solicita e-mail de recuperação de senha */
export async function solicitarResetSenha(email) {
  // Deriva o redirectTo a partir da URL atual (garante path correto em qualquer deploy)
  const base = window.location.href.replace(/\/[^/]*(\?.*)?$/, '/')
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: base + 'reset-password.html'
  })
  if (error) throw error
}

/** Redefine a nova senha (usar na página reset-password.html) */
export async function redefinirSenha(novaSenha) {
  const { error } = await sb.auth.updateUser({ password: novaSenha })
  if (error) throw error
}

/** Retorna o usuário autenticado atual (ou null) */
export async function getUser() {
  const { data: { user } } = await sb.auth.getUser()
  return user
}

/** Retorna o profile completo do usuário logado (com dados do tenant) */
export async function getProfile() {
  const user = await getUser()
  if (!user) return null
  const { data, error } = await sb
    .from('profiles')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

/** Guarda o profile em cache na sessão para evitar queries repetidas */
let _profileCache = null
export async function getProfileCached() {
  if (_profileCache) return _profileCache
  _profileCache = await getProfile()
  return _profileCache
}
export function clearProfileCache() { _profileCache = null }

/**
 * Redireciona para login.html se não autenticado.
 * Retorna o profile se autenticado.
 */
export async function requireAuth(rolesPermitidos = null) {
  const profile = await getProfileCached()
  if (!profile) {
    window.location.href = './login.html'
    return null
  }
  if (rolesPermitidos && !rolesPermitidos.includes(profile.role)) {
    window.location.href = './acesso-negado.html'
    return null
  }
  return profile
}

// ============================================================
// COLABORADORES
// ============================================================

export async function getColaboradores(filtros = {}) {
  let q = sb.from('colaboradores').select('*').order('nome')
  if (filtros.status)          q = q.eq('status', filtros.status)
  if (filtros.gestor_email)    q = q.eq('gestor_email', filtros.gestor_email)
  if (filtros.tipo_vinculo)    q = q.eq('tipo_vinculo', filtros.tipo_vinculo)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function getColaboradorByEmail(email) {
  const { data, error } = await sb
    .from('colaboradores')
    .select('*')
    .eq('email_corporativo', email)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertColaborador(colab) {
  const { data, error } = await sb
    .from('colaboradores')
    .upsert(colab, { onConflict: 'tenant_id,id_colaborador' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateColaborador(id, campos) {
  const { data, error } = await sb
    .from('colaboradores')
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteColaborador(id) {
  const { error } = await sb.from('colaboradores').delete().eq('id', id)
  if (error) throw error
}

/** Gera próximo id_colaborador (COL-001, COL-002...) */
export async function gerarIdColaborador(tenantId) {
  const { data, error } = await sb.rpc('gen_id_colaborador', { p_tenant_id: tenantId })
  if (error) throw error
  return data
}

// ============================================================
// FÉRIAS — SALDO
// ============================================================

export async function getFeriasSaldo(colaboradorId) {
  const { data, error } = await sb
    .from('ferias_saldo')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function updateFeriasSaldo(colaboradorId, campos) {
  const { data, error } = await sb
    .from('ferias_saldo')
    .upsert({ colaborador_id: colaboradorId, ...campos }, { onConflict: 'colaborador_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// SOLICITAÇÕES DE FÉRIAS
// ============================================================

export async function getSolicitacoesFerias(colaboradorId = null) {
  let q = sb.from('solicitacoes_ferias').select(`
    *, colaboradores(nome, email_corporativo, gestor, gestor_email, tipo_vinculo)
  `).order('solicitado_em', { ascending: false })
  if (colaboradorId) q = q.eq('colaborador_id', colaboradorId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function criarSolicitacaoFerias(solicitacao) {
  const { data, error } = await sb
    .from('solicitacoes_ferias')
    .insert(solicitacao)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarStatusSolicitacao(id, status, motivo = null) {
  const { data, error } = await sb
    .from('solicitacoes_ferias')
    .update({ status, motivo_rejeicao: motivo, decisao_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSolicitacaoPorProtocolo(protocolo) {
  const { data, error } = await sb
    .from('solicitacoes_ferias')
    .select(`*, colaboradores(*)`)
    .eq('protocolo', protocolo)
    .single()
  if (error) throw error
  return data
}

// ============================================================
// EXAMES OCUPACIONAIS
// ============================================================

export async function getExames() {
  const { data, error } = await sb
    .from('exames_ocupacionais')
    .select('*, colaboradores(nome, status)')
    .order('proximo_exame')
  if (error) throw error
  return data
}

export async function updateExame(id, campos) {
  const { data, error } = await sb
    .from('exames_ocupacionais')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// AUSÊNCIAS / OCORRÊNCIAS
// ============================================================

export async function getAusencias() {
  const { data, error } = await sb
    .from('ausencias_ocorrencias')
    .select('*, colaboradores(nome)')
    .order('data', { ascending: false })
  if (error) throw error
  return data
}

export async function inserirAusencia(ausencia) {
  const { data, error } = await sb
    .from('ausencias_ocorrencias')
    .insert(ausencia)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// DESLIGAMENTOS AGENDADOS
// ============================================================

export async function getDesligamentosAgendados() {
  const { data, error } = await sb
    .from('desligamentos_agendados')
    .select('*, colaboradores(nome, cargo, tipo_vinculo, gestor, gestor_email)')
    .order('data_desligamento')
  if (error) throw error
  return data
}

export async function agendarDesligamento(colab, dataDesl) {
  const { data, error } = await sb
    .from('desligamentos_agendados')
    .insert({
      tenant_id: colab.tenant_id,
      colaborador_id: colab.id,
      data_desligamento: dataDesl
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Retorna todos os registros de férias com dados do colaborador (para o painel admin) */
export async function getAllFeriasSaldo() {
  const { data, error } = await sb
    .from('ferias_saldo')
    .select('*, colaboradores(id, id_colaborador, nome, email_corporativo, tipo_vinculo, gestor, gestor_email, tenant_id)')
    .order('criado_em')
  if (error) throw error
  return data
}

export async function marcarLembreteEnviado(id) {
  const { error } = await sb
    .from('desligamentos_agendados')
    .update({ lembrete_enviado: true, lembrete_enviado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ============================================================
// PROFILES / USUÁRIOS (admin)
// ============================================================

export async function getProfiles() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

export async function updateProfile(id, campos) {
  const { data, error } = await sb
    .from('profiles')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// TENANTS (manager_global apenas)
// ============================================================

export async function getTenants() {
  const { data, error } = await sb
    .from('tenants')
    .select('*, profiles(count)')
    .order('nome')
  if (error) throw error
  return data
}

export async function criarTenant(tenant) {
  const { data, error } = await sb
    .from('tenants')
    .insert(tenant)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTenant(id, campos) {
  const { data, error } = await sb
    .from('tenants')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// LOG DE EVENTOS
// ============================================================

export async function logEvento(tipo, descricao, dados = {}) {
  try {
    const profile = await getProfileCached()
    await sb.from('log_eventos').insert({
      tenant_id: profile?.tenant_id || null,
      tipo, descricao, dados,
      usuario_id: profile?.id || null
    })
  } catch (_) {
    // log silencioso — não quebrar o fluxo principal
  }
}
