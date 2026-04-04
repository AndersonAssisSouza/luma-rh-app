import {
  sb, requireAuth, logout,
  getMensagensAniversario, upsertMensagemAniversario,
  deleteMensagemAniversario, seedMensagensDefault, getProfileCached,
  getTenantConfig, applyTenantTheme
} from './supabase_client.js'

window._sbLogout = () => logout()

;(async () => {
  const profile = await requireAuth(['master','rh','gestor','manager_global'])
  if (!profile) return
  window._profile = profile

  // Expõe funções
  window._getMsgs    = getMensagensAniversario
  window._upsertMsg  = upsertMensagemAniversario
  window._deleteMsg  = deleteMensagemAniversario
  window._seedMsgs   = () => seedMensagensDefault(profile.tenant_id)
  window._getProfile = getProfileCached

  // Aplica tema do tenant (cores + logo) e carrega modelos
  try {
    const tenantData = await getTenantConfig()
    applyTenantTheme(tenantData.config || {})
    // Guarda modelos para uso na geração de cards
    if (Array.isArray(tenantData.config?.modelos)) {
      window._tenantModelos = tenantData.config.modelos
    }
  } catch (_) {}

  // Sinaliza que auth completou
  window._authReady = true
  document.dispatchEvent(new Event('auth-ready'))
})()
</script>

<!-- HEADER -->
<div class="header">
  <div class="logo">
    <div class="logo-icon tenant-logo-svg">L</div><img class="tenant-logo-img" src="" alt="Logo" style="display:none;width:38px;height:38px;object-fit:contain;border-radius:8px;">
    <div>
      <div class="logo-text">LUMA RH</div>
      <div class="logo-sub">Mensagens de Aniversário</div>
    </div>
  </div>
  <div class="header-nav">
    <a href="./people_analytics_editor.html" class="btn-back">← Voltar ao Sistema</a>
    <button class="btn-sair" onclick="window._sbLogout&&_sbLogout()">Sair</button>
  </div>
</div>

<!-- TABS -->
<div class="tabs">
  <button class="tab active" onclick="showTab('mensagens',this)">📝 Banco de Mensagens</button>
  <button class="tab" onclick="showTab('gerar',this)">🎨 Gerar Post</button>
</div>

<div class="main">

  <!-- ===== TAB MENSAGENS ===== -->
  <div id="tab-mensagens">
    <div class="msgs-grid">
      <!-- Aniversário Funcionário -->
      <div class="msgs-col">
        <div class="msgs-col-header">
          <div class="msgs-col-title">🎂 Aniversário de Funcionário <span class="badge badge-func" id="count-func">0</span></div>
          <button class="btn-add" onclick="openModal('funcionario')">+ Adicionar</button>
        </div>
        <div class="msgs-list" id="list-funcionario">
          <div class="empty-state">Carregando...</div>
        </div>
      </div>
      <!-- Aniversário Empresa -->
      <div class="msgs-col">
        <div class="msgs-col-header">
          <div class="msgs-col-title">🏆 Aniversário de Empresa <span class="badge badge-emp" id="count-emp">0</span></div>
          <button class="btn-add" onclick="openModal('empresa')">+ Adicionar</button>
        </div>
        <div class="msgs-list" id="list-empresa">
          <div class="empty-state">Carregando...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== TAB GERAR ===== -->
  <div id="tab-gerar" style="display:none">
    <div class="gerar-wrap">
      <div class="form-card">
        <h3>Configurar Post</h3>
        <div class="fgrp">
          <label for="g-tipo">Tipo de comemoração</label>
          <select id="g-tipo" onchange="onTipoChange()">
            <option value="funcionario">🎂 Aniversário de Funcionário</option>
            <option value="empresa">🏆 Aniversário de Empresa</option>
          </select>
        </div>
        <div class="fgrp">
          <label for="g-empresa">Empresa</label>
          <select id="g-empresa">
            <option value="luisa">Luisa Moraes Advogados</option>
            <option value="luma">Luma Plataforma</option>
          </select>
        </div>
        <div class="fgrp">
          <label for="g-nome">Nome do colaborador</label>
          <input type="text" id="g-nome" placeholder="Ex: Maria Silva">
        </div>
        <div class="fgrp" id="fgrp-anos" style="display:none">
          <label for="g-anos">Anos de empresa</label>
          <input type="number" id="g-anos" min="1" max="50" placeholder="Ex: 3">
        </div>
        <div class="fgrp">
          <label for="g-msg-manual">Mensagem personalizada (opcional)</label>
          <textarea id="g-msg-manual" placeholder="Deixe em branco para sortear automaticamente das mensagens cadastradas..."></textarea>
          <div class="hint">Use {nome} e {anos} como variáveis. Ex: Parabéns, {nome}! {anos} anos conosco!</div>
        </div>
        <button class="btn-gerar" id="btn-gerar" onclick="gerarPost()">🎨 Gerar Post</button>
      </div>

      <div class="preview-card">
        <h3>🖼️ Pré-visualização</h3>
        <div id="preview-hint" class="preview-hint">
          Preencha o formulário e clique em<br><strong>"Gerar Post"</strong> para criar o card.
        </div>
        <div class="canvas-wrap">
          <canvas id="canvas-preview"></canvas>
        </div>
        <div class="msg-preview-info" id="msg-preview-info">
          <p>Mensagem sorteada:</p>
          <div class="msg-selected" id="msg-selected-text"></div>
        </div>
        <button class="btn-download" id="btn-download" onclick="downloadPost()">⬇️ Download da imagem</button>
      </div>
    </div>
  </div>

</div><!-- /main -->

<!-- MODAL EDIÇÃO -->
<div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <h3 id="modal-title">Nova mensagem</h3>
    <input type="hidden" id="modal-id">
    <input type="hidden" id="modal-tipo">
    <div class="fgrp">
      <label>Texto da mensagem</label>
      <textarea id="modal-texto" rows="5" placeholder="Use {nome} para o nome e {anos} para os anos de empresa..."></textarea>
      <div class="hint">Variáveis disponíveis: {nome} → nome do colaborador &nbsp;|&nbsp; {anos} → anos de empresa</div>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" id="btn-save-modal" onclick="saveModal()">Salvar mensagem</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<script>
// ============================================================
// CONFIG DE MODELOS DE IMAGEM
// ============================================================
// Mapeamento: empresa + tipo → arquivo de imagem
// Luisa Moraes + funcionário → modelo1.jpg
// Luisa Moraes + empresa     → modelo3.jpg
// Luma          + funcionário → modelo2.jpg
// Luma          + empresa     → modelo4.jpg

const MODELO_CONFIG = {
  modelo1: {
    // Dark red com "FELIZ ANIVERSÁRIO" pre-baked no topo esquerdo
    textColor: '#ffffff',
    nameColor: '#ffd000',
    shadowColor: 'rgba(0,0,0,0.7)',
    textX: 0.07,
    textY: 0.30,    // próximo à barra abaixo do texto de aniversário
    textW: 0.60,
    nameSizePct: 0.048,
    bodySizePct: 0.032,
    lineH: 1.55,
    align: 'left',
    separatorColor: 'rgba(255,208,0,0.6)'
  },
  modelo2: {
    // Roxo com "FELIZ ANIVERSÁRIO" pre-baked no topo esquerdo
    textColor: '#ffffff',
    nameColor: '#ffd000',
    shadowColor: 'rgba(0,0,0,0.7)',
    textX: 0.07,
    textY: 0.30,
    textW: 0.58,
    nameSizePct: 0.048,
    bodySizePct: 0.032,
    lineH: 1.55,
    align: 'left',
    separatorColor: 'rgba(255,208,0,0.6)'
  },
  modelo3: {
    // Dark maroon — título já está na imagem, não repetir
    textColor: '#c9a84c',
    nameColor: '#ffd000',
    shadowColor: 'rgba(0,0,0,0.6)',
    textX: 0.07,
    textY: 0.38,
    textW: 0.62,
    nameSizePct: 0.048,
    bodySizePct: 0.032,
    lineH: 1.55,
    align: 'left',
    separatorColor: 'rgba(201,168,76,0.7)'
  },
  modelo4: {
    // Dark purple — título já está na imagem, não repetir
    textColor: '#c4b5fd',
    nameColor: '#ffd000',
    shadowColor: 'rgba(0,0,0,0.6)',
    textX: 0.06,
    textY: 0.38,
    textW: 0.60,
    nameSizePct: 0.048,
    bodySizePct: 0.032,
    lineH: 1.55,
    align: 'left',
    separatorColor: 'rgba(196,181,253,0.6)'
  }
}

function getModelo(empresa, tipo) {
  if (empresa === 'luisa') return tipo === 'funcionario' ? 'modelo1' : 'modelo3'
  return tipo === 'funcionario' ? 'modelo2' : 'modelo4'
}

// ============================================================
// ESTADO
// ============================================================
let _msgs = []
let _lastCanvas = null

// ============================================================
// INIT
// ============================================================
document.addEventListener('auth-ready', async () => {
  await loadMensagens()
})

async function loadMensagens() {
  try {
    _msgs = await window._getMsgs()
    // Se não tem nenhuma mensagem, seed defaults
    if (_msgs.length === 0) {
      await window._seedMsgs()
      _msgs = await window._getMsgs()
      toast('10 mensagens padrão criadas!', 'info')
    }
    renderLists()
  } catch(e) {
    toast('Erro ao carregar mensagens: ' + e.message, 'error')
  }
}

function renderLists() {
  const func = _msgs.filter(m => m.tipo === 'funcionario')
  const emp  = _msgs.filter(m => m.tipo === 'empresa')

  document.getElementById('count-func').textContent = func.length
  document.getElementById('count-emp').textContent  = emp.length

  document.getElementById('list-funcionario').innerHTML =
    func.length ? func.map(renderCard).join('') : '<div class="empty-state">Nenhuma mensagem cadastrada.</div>'
  document.getElementById('list-empresa').innerHTML =
    emp.length ? emp.map(renderCard).join('') : '<div class="empty-state">Nenhuma mensagem cadastrada.</div>'
}

function renderCard(m) {
  const inativo = !m.ativo ? ' inativo' : ''
  const toggleIcon = m.ativo ? '👁' : '🚫'
  const toggleTitle = m.ativo ? 'Desativar' : 'Ativar'
  const toggleClass = m.ativo ? '' : ' off'
  return `<div class="msg-card${inativo}" id="card-${m.id}">
    <div class="msg-texto">${escHtml(m.texto)}</div>
    <div class="msg-actions">
      <button class="btn-icon btn-toggle${toggleClass}" title="${toggleTitle}" onclick="toggleAtivo('${m.id}',${m.ativo})">${toggleIcon}</button>
      <button class="btn-icon btn-edit" title="Editar" onclick="openModal('${m.tipo}','${m.id}')">✏️</button>
      <button class="btn-icon btn-del" title="Excluir" onclick="deleteMsg('${m.id}')">🗑</button>
    </div>
  </div>`
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
}
// Alias para consistência com outros módulos
const esc = escHtml

// ============================================================
// TABS
// ============================================================
function showTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  document.getElementById('tab-mensagens').style.display = name === 'mensagens' ? '' : 'none'
  document.getElementById('tab-gerar').style.display     = name === 'gerar'     ? '' : 'none'
}

function onTipoChange() {
  const tipo = document.getElementById('g-tipo').value
  document.getElementById('fgrp-anos').style.display = tipo === 'empresa' ? '' : 'none'
}

// ============================================================
// MODAL
// ============================================================
function openModal(tipo, id) {
  const existing = id ? _msgs.find(m => m.id === id) : null
  document.getElementById('modal-title').textContent = existing ? 'Editar mensagem' : 'Nova mensagem'
  document.getElementById('modal-id').value   = existing ? existing.id  : ''
  document.getElementById('modal-tipo').value = existing ? existing.tipo : tipo
  document.getElementById('modal-texto').value = existing ? existing.texto : ''
  document.getElementById('modal-overlay').classList.add('open')
  document.getElementById('modal-texto').focus()
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

async function saveModal() {
  const id    = document.getElementById('modal-id').value
  const tipo  = document.getElementById('modal-tipo').value
  const texto = document.getElementById('modal-texto').value.trim()
  if (!texto) { toast('Digite o texto da mensagem.', 'error'); return }

  const btn = document.getElementById('btn-save-modal')
  btn.disabled = true; btn.innerHTML = '<span class="loading"></span>Salvando...'
  try {
    const payload = { tipo, texto, ativo: true }
    if (id) payload.id = id
    const saved = await window._upsertMsg(payload)
    // Atualiza lista local
    const idx = _msgs.findIndex(m => m.id === saved.id)
    if (idx >= 0) _msgs[idx] = saved; else _msgs.push(saved)
    renderLists()
    closeModal()
    toast('Mensagem salva!', 'success')
  } catch(e) {
    toast('Erro: ' + e.message, 'error')
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar mensagem'
  }
}

// ============================================================
// TOGGLE ATIVO / DELETE
// ============================================================
async function toggleAtivo(id, currentAtivo) {
  try {
    const msg = _msgs.find(m => m.id === id)
    if (!msg) return
    const saved = await window._upsertMsg({ ...msg, ativo: !currentAtivo })
    const idx = _msgs.findIndex(m => m.id === id)
    if (idx >= 0) _msgs[idx] = saved
    renderLists()
    toast(saved.ativo ? 'Mensagem ativada.' : 'Mensagem desativada.', 'info')
  } catch(e) { toast('Erro: ' + e.message, 'error') }
}

async function deleteMsg(id) {
  if (!confirm('Excluir esta mensagem permanentemente?')) return
  try {
    await window._deleteMsg(id)
    _msgs = _msgs.filter(m => m.id !== id)
    renderLists()
    toast('Mensagem excluída.', 'info')
  } catch(e) { toast('Erro: ' + e.message, 'error') }
}

// ============================================================
// GERAR POST
// ============================================================
async function gerarPost() {
  const tipo    = document.getElementById('g-tipo').value
  const empresa = document.getElementById('g-empresa').value
  const nome    = document.getElementById('g-nome').value.trim()
  const anos    = document.getElementById('g-anos').value.trim()
  const manual  = document.getElementById('g-msg-manual').value.trim()

  if (!nome) { toast('Informe o nome do colaborador.', 'error'); return }
  if (tipo === 'empresa' && !anos) { toast('Informe os anos de empresa.', 'error'); return }

  // Seleciona mensagem
  let textoFinal
  if (manual) {
    textoFinal = manual
  } else {
    const pool = _msgs.filter(m => m.tipo === tipo && m.ativo)
    if (pool.length === 0) { toast('Nenhuma mensagem ativa para este tipo. Cadastre uma na aba "Banco de Mensagens".', 'error'); return }
    const chosen = pool[Math.floor(Math.random() * pool.length)]
    textoFinal = chosen.texto
    document.getElementById('msg-selected-text').textContent = chosen.texto
    document.getElementById('msg-preview-info').style.display = 'block'
  }

  // Substitui variáveis
  textoFinal = textoFinal.replace(/\{nome\}/gi, nome).replace(/\{anos\}/gi, anos || '')

  // Determina imagem — usa base64 do config se disponível, senão tenta arquivo local
  const modeloKey = getModelo(empresa, tipo)
  const modeloCfg = (window._tenantModelos || []).find(m => m.key === modeloKey)
  const imgSrc = modeloCfg?.base64 || `./assets/${modeloKey}.jpg`

  const btn = document.getElementById('btn-gerar')
  btn.disabled = true; btn.innerHTML = '<span class="loading"></span>Gerando...'

  await renderCanvas(imgSrc, nome, textoFinal, tipo, modeloKey)
  toast('Post gerado!', 'success')
  btn.disabled = false; btn.textContent = '🎨 Gerar Post'
}

// ============================================================
// CANVAS
// ============================================================
async function renderCanvas(imgSrc, nome, texto, tipo, modeloKey) {
  return new Promise((resolve) => {
    const canvas = document.getElementById('canvas-preview')
    const ctx = canvas.getContext('2d')

    function drawText(W, H, c) {
      const x    = W * c.textX
      const maxW = W * c.textW
      const nameSize = H * c.nameSizePct
      const bodySize = H * c.bodySizePct
      ctx.textBaseline = 'top'
      ctx.textAlign    = 'left'
      let curY = H * c.textY

      if (c.headerText) {
        const tipoLabel = tipo === 'funcionario' ? 'ANIVERSÁRIO' : 'ANIVERSÁRIO DE EMPRESA'
        setShadow(ctx, c.shadowColor)
        ctx.fillStyle = c.textColor
        ctx.font = `300 ${bodySize * 0.85}px Arial, sans-serif`
        ctx.fillText('FELIZ', x, curY); curY += bodySize * 1.1
        ctx.font = `900 ${nameSize * 1.05}px Arial, sans-serif`
        ctx.fillText(tipoLabel, x, curY); curY += nameSize * 1.3
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = c.separatorColor; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x, curY); ctx.lineTo(x + maxW * 0.55, curY); ctx.stroke()
        curY += nameSize * 0.9
        setShadow(ctx, c.shadowColor)
      }

      ctx.fillStyle = c.nameColor
      ctx.font = `700 ${nameSize}px Arial, sans-serif`
      const nomeWrapped = wrapText(ctx, nome, x, curY, maxW, nameSize * c.lineH, false)
      curY += nomeWrapped * nameSize * c.lineH

      if (!c.headerText) {
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = c.separatorColor; ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x, curY + nameSize * 0.2)
        ctx.lineTo(x + maxW * 0.55, curY + nameSize * 0.2)
        ctx.stroke()
        curY += nameSize * 0.7
        setShadow(ctx, c.shadowColor)
      }

      ctx.fillStyle = c.textColor
      ctx.font = `400 ${bodySize}px Arial, sans-serif`
      wrapText(ctx, texto, x, curY, maxW, bodySize * c.lineH, true)

      canvas.style.display = 'block'
      document.getElementById('preview-hint').style.display = 'none'
      document.getElementById('btn-download').style.display = 'block'
      _lastCanvas = canvas
    }

    const cfg = MODELO_CONFIG[modeloKey] || MODELO_CONFIG.modelo1

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      drawText(canvas.width, canvas.height, cfg)
      resolve()
    }
    img.onerror = () => {
      canvas.width = 1080; canvas.height = 1920
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920)
      grad.addColorStop(0, '#1a0e2e'); grad.addColorStop(1, '#0f0e17')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920)
      ctx.fillStyle = 'rgba(155,102,244,0.18)'
      ctx.beginPath(); ctx.arc(950, 180, 380, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,208,0,0.08)'
      ctx.beginPath(); ctx.arc(130, 1780, 500, 0, Math.PI * 2); ctx.fill()
      drawText(1080, 1920, {...cfg, headerText: true, textY: 0.12})
      resolve()
    }
    img.src = imgSrc
  })
}

function setShadow(ctx, color) {
  ctx.shadowColor   = color
  ctx.shadowBlur    = 6
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 1
}

// Retorna número de linhas desenhadas
function wrapText(ctx, text, x, y, maxWidth, lineHeight, draw) {
  const lines = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = word
      } else { line = test }
    }
    lines.push(line)
  }
  if (draw) {
    let curY = y
    for (const l of lines) {
      if (l) ctx.fillText(l, x, curY)
      curY += lineHeight
    }
  }
  return lines.length
}

// ============================================================
// DOWNLOAD
// ============================================================
function downloadPost() {
  if (!_lastCanvas) return
  const tipo    = document.getElementById('g-tipo').value
  const nome    = document.getElementById('g-nome').value.trim().replace(/\s+/g,'_')
  const empresa = document.getElementById('g-empresa').value
  const tipoLabel = tipo === 'funcionario' ? 'aniv_func' : 'aniv_empresa'
  const link = document.createElement('a')
  link.download = `luma_${tipoLabel}_${nome}_${empresa}.png`
  link.href = _lastCanvas.toDataURL('image/png')
  link.click()
}

// ============================================================
// TOAST
// ============================================================
let _toastTimer
function toast(msg, type = 'success') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = 'toast show ' + type
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500)
}