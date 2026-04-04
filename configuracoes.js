import {
  sb, requireAuth, logout,
  getTenantConfig, saveTenantConfig, applyTenantTheme
} from './supabase_client.js'

window._sbLogout = () => logout()

;(async () => {
  const profile = await requireAuth(['master','manager_global'])
  if (!profile) return
  window._profile = profile
  window._getTenantConfig  = getTenantConfig
  window._saveTenantConfig = saveTenantConfig
  window._applyTheme       = applyTenantTheme
  document.dispatchEvent(new Event('auth-ready'))
})()
</script>

<!-- HEADER -->
<div class="header">
  <div class="logo">
    <div class="logo-box">
      <svg class="tenant-logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="12" fill="#9b66f4"/>
        <polygon points="20,15 42,15 50,72 58,15 80,15 60,88 40,88" fill="#ffd000"/>
      </svg>
      <img class="tenant-logo-img" alt="Logo">
    </div>
    <div>
      <div class="logo-text">LUMA RH</div>
      <div class="logo-sub">Configurações</div>
    </div>
  </div>
  <div class="header-nav">
    <a href="./people_analytics_editor.html" class="btn-back">← Voltar ao Sistema</a>
    <button class="btn-sair" onclick="window._sbLogout&&_sbLogout()">Sair</button>
  </div>
</div>

<div class="main">
  <div class="page-title">⚙️ Configurações</div>
  <div class="page-sub">Personalize a identidade visual e os modelos do sistema</div>

  <div class="cards-grid">
  <!-- IDENTIDADE VISUAL -->
  <div class="card">
    <div class="card-header">
      <span class="card-icon">🎨</span>
      <span class="card-title">Identidade Visual</span>
    </div>
    <div class="card-desc">Cores e logo do sistema. Se não configurado, usa as cores padrão LUMA.</div>

    <!-- Logo -->
    <div class="fgrp">
      <label>Logo do Sistema</label>
      <div class="logo-upload" id="logo-drop" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="onLogoDrop(event)">
        <input type="file" accept="image/jpeg,image/png,image/bmp,image/gif,image/webp,image/svg+xml" onchange="onLogoFile(this)">
        <img id="logo-preview" class="logo-preview" alt="Preview">
        <div id="logo-placeholder">
          <div class="logo-upload-icon">📤</div>
          <div class="logo-upload-text">Clique para enviar o logo</div>
          <div class="logo-upload-hint">JPG, PNG, BMP, GIF, WebP ou SVG</div>
        </div>
        <button class="logo-clear" id="logo-clear" onclick="clearLogo(event)">✕ Remover logo</button>
      </div>
    </div>

    <!-- Cores -->
    <div class="color-row">
      <div class="fgrp">
        <label>Cor Primária</label>
        <div class="color-input-wrap">
          <div class="color-swatch" id="swatch-primary" style="background:#9b66f4;">
            <input type="color" id="picker-primary" value="#9b66f4" oninput="onColorChange('primary',this.value)">
          </div>
          <input type="text" id="text-primary" value="#9b66f4" maxlength="7"
            oninput="onColorText('primary',this.value)" placeholder="#9b66f4">
        </div>
        <button class="reset-btn" onclick="resetColor('primary')">Restaurar padrão (#9b66f4)</button>
      </div>
      <div class="fgrp">
        <label>Cor Secundária</label>
        <div class="color-input-wrap">
          <div class="color-swatch" id="swatch-secondary" style="background:#ffd000;">
            <input type="color" id="picker-secondary" value="#ffd000" oninput="onColorChange('secondary',this.value)">
          </div>
          <input type="text" id="text-secondary" value="#ffd000" maxlength="7"
            oninput="onColorText('secondary',this.value)" placeholder="#ffd000">
        </div>
        <button class="reset-btn" onclick="resetColor('secondary')">Restaurar padrão (#ffd000)</button>
      </div>
    </div>

    <div class="color-preview-row">
      <div class="preview-btn primary" id="prev-primary">Cor Primária</div>
      <div class="preview-btn secondary" id="prev-secondary">Cor Secundária</div>
    </div>
  </div>

  <!-- MODELOS DE ANIVERSÁRIO -->
  <div class="card" style="overflow:auto;">
    <div class="card-header">
      <span class="card-icon">🎂</span>
      <span class="card-title">Modelos de Aniversário</span>
    </div>
    <div class="card-desc">
      Imagens usadas para gerar os cards de aniversário. Defina a empresa e o tipo de cada modelo.
    </div>
    <div class="modelos-grid" id="modelos-grid">
      <!-- Renderizado via JS -->
    </div>
  </div>

  </div><!-- /cards-grid -->
  <!-- SALVAR -->
  <div class="save-bar">
    <button class="btn-save" id="btn-save" onclick="salvarConfig()">
      💾 Salvar Configurações
    </button>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ============================================================
// SEGURANÇA: escape HTML para prevenir XSS
// ============================================================
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
}

// ============================================================
// ESTADO
// ============================================================
let _cfg = {
  cor_primaria: '#9b66f4',
  cor_secundaria: '#ffd000',
  logo_base64: null,
  modelos: [
    { key: 'modelo1', empresa: 'luisa', tipo: 'funcionario', base64: null },
    { key: 'modelo2', empresa: 'luma',  tipo: 'funcionario', base64: null },
    { key: 'modelo3', empresa: 'luisa', tipo: 'empresa',     base64: null },
    { key: 'modelo4', empresa: 'luma',  tipo: 'empresa',     base64: null }
  ]
}
const EMPRESA_OPTS = [
  { value: 'luisa', label: 'Luisa Moraes Advogados' },
  { value: 'luma',  label: 'Luma Plataforma' }
]
const TIPO_OPTS = [
  { value: 'funcionario', label: '🎂 Aniversário de Funcionário' },
  { value: 'empresa',     label: '🏆 Aniversário de Empresa' }
]

// ============================================================
// INIT
// ============================================================
document.addEventListener('auth-ready', async () => {
  try {
    const tenant = await window._getTenantConfig()
    const cfg = tenant.config || {}
    if (cfg.cor_primaria)   _cfg.cor_primaria   = cfg.cor_primaria
    if (cfg.cor_secundaria) _cfg.cor_secundaria = cfg.cor_secundaria
    if (cfg.logo_base64)    _cfg.logo_base64    = cfg.logo_base64
    if (Array.isArray(cfg.modelos) && cfg.modelos.length === 4) _cfg.modelos = cfg.modelos

    renderColors()
    renderLogo()
    renderModelos()
    window._applyTheme(cfg)
  } catch(e) {
    toast('Erro ao carregar configurações: ' + e.message, 'error')
    renderModelos()
  }
})

// ============================================================
// CORES
// ============================================================
function renderColors() {
  setColor('primary',   _cfg.cor_primaria)
  setColor('secondary', _cfg.cor_secundaria)
}

function setColor(key, val) {
  const hex = val || (key === 'primary' ? '#9b66f4' : '#ffd000')
  document.getElementById('picker-' + key).value = hex
  document.getElementById('text-'   + key).value = hex
  document.getElementById('swatch-' + key).style.background = hex
  const cssKey = key === 'primary' ? '--prev-primary' : '--prev-secondary'
  document.documentElement.style.setProperty(cssKey, hex)
}

function onColorChange(key, val) {
  document.getElementById('text-' + key).value = val
  document.getElementById('swatch-' + key).style.background = val
  document.documentElement.style.setProperty(key === 'primary' ? '--prev-primary' : '--prev-secondary', val)
  if (key === 'primary')   _cfg.cor_primaria   = val
  else                     _cfg.cor_secundaria = val
}

function onColorText(key, val) {
  if (!/^#[0-9a-fA-F]{6}$/.test(val)) return
  onColorChange(key, val)
  document.getElementById('picker-' + key).value = val
}

function resetColor(key) {
  const def = key === 'primary' ? '#9b66f4' : '#ffd000'
  onColorChange(key, def)
  document.getElementById('text-' + key).value = def
  document.getElementById('picker-' + key).value = def
}

// ============================================================
// LOGO
// ============================================================
function renderLogo() {
  if (_cfg.logo_base64) {
    showLogoPreview(_cfg.logo_base64)
  }
}

function showLogoPreview(src) {
  const prev = document.getElementById('logo-preview')
  const ph   = document.getElementById('logo-placeholder')
  const clr  = document.getElementById('logo-clear')
  prev.src = src; prev.style.display = 'block'
  ph.style.display  = 'none'
  clr.style.display = 'block'
}

function onLogoFile(input) {
  const file = input.files?.[0]
  if (!file) return
  compressImage(file, 400, 0.88).then(b64 => {
    _cfg.logo_base64 = b64
    showLogoPreview(b64)
    // Aplica já no header da própria página
    document.querySelectorAll('.tenant-logo-img').forEach(e => { e.src = b64; e.style.display = 'block' })
    document.querySelectorAll('.tenant-logo-svg').forEach(e => e.style.display = 'none')
    salvarConfig()
  })
}

function onLogoDrop(e) {
  e.preventDefault()
  document.getElementById('logo-drop').classList.remove('drag')
  const file = e.dataTransfer?.files?.[0]
  if (file) onLogoFile({ files: [file] })
}

function clearLogo(e) {
  e.preventDefault(); e.stopPropagation()
  _cfg.logo_base64 = null
  document.getElementById('logo-preview').style.display = 'none'
  document.getElementById('logo-placeholder').style.display = ''
  document.getElementById('logo-clear').style.display = 'none'
  document.querySelectorAll('.tenant-logo-img').forEach(el => { el.src=''; el.style.display='none' })
  document.querySelectorAll('.tenant-logo-svg').forEach(el => el.style.display='block')
}

// ============================================================
// MODELOS
// ============================================================
function renderModelos() {
  const grid = document.getElementById('modelos-grid')
  grid.innerHTML = _cfg.modelos.map((m, i) => `
    <div class="modelo-slot" id="slot-${i}">
      <div class="modelo-preview" id="prev-${i}">
        <img id="img-${i}" src="${m.base64 ? esc(m.base64) : ''}" alt="Modelo ${i+1}" ${m.base64?'style="display:block"':''}>
        <div class="placeholder" ${m.base64?'style="display:none"':''} id="ph-${i}">
          <div class="icon">🖼️</div>
          <div class="txt">Modelo ${i+1}</div>
        </div>
        <div class="overlay">
          <button onclick="triggerModeloUpload(${i})" style="background:rgba(255,255,255,.9);border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">📤 Trocar</button>
        </div>
      </div>
      <div class="modelo-info">
        <div class="modelo-num">Modelo ${i+1}</div>
        <label style="font-size:11px;margin-bottom:4px;">Empresa</label>
        <select class="modelo-select" id="emp-${i}" onchange="_cfg.modelos[${i}].empresa=this.value">
          ${EMPRESA_OPTS.map(o=>`<option value="${esc(o.value)}" ${m.empresa===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
        </select>
        <label style="font-size:11px;margin-bottom:4px;margin-top:8px;display:block;">Tipo</label>
        <select class="modelo-select" id="tipo-${i}" onchange="_cfg.modelos[${i}].tipo=this.value">
          ${TIPO_OPTS.map(o=>`<option value="${esc(o.value)}" ${m.tipo===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}
        </select>
        <div class="modelo-upload-btn" style="margin-top:8px;">
          📤 ${m.base64?'Trocar imagem':'Enviar imagem'}
          <input type="file" accept="image/jpeg,image/png,image/bmp,image/gif,image/webp" onchange="onModeloFile(${i},this)">
        </div>
        <button class="modelo-clear-btn" id="clr-${i}" onclick="clearModelo(${i})" ${m.base64?'style="display:block"':''}>✕ Remover</button>
      </div>
    </div>
  `).join('')
}

function triggerModeloUpload(i) {
  document.querySelector(`#slot-${i} .modelo-upload-btn input`).click()
}

function onModeloFile(i, input) {
  const file = input.files?.[0]
  if (!file) return
  compressImage(file, 900, 0.80).then(b64 => {
    _cfg.modelos[i].base64 = b64
    const img = document.getElementById('img-' + i)
    const ph  = document.getElementById('ph-'  + i)
    const clr = document.getElementById('clr-' + i)
    img.src = b64; img.style.display = 'block'
    ph.style.display  = 'none'
    clr.style.display = 'block'
    document.querySelector(`#slot-${i} .modelo-upload-btn`).innerHTML =
      '🔄 Trocar imagem<input type="file" accept="image/jpeg,image/png,image/bmp,image/gif,image/webp" onchange="onModeloFile('+i+',this)">'
    salvarConfig()
  })
}

function clearModelo(i) {
  _cfg.modelos[i].base64 = null
  const img = document.getElementById('img-' + i)
  const ph  = document.getElementById('ph-'  + i)
  const clr = document.getElementById('clr-' + i)
  img.src = ''; img.style.display = 'none'
  ph.style.display  = 'flex'
  clr.style.display = 'none'
}

// ============================================================
// SALVAR
// ============================================================
async function salvarConfig() {
  const btn = document.getElementById('btn-save')
  btn.disabled = true
  btn.innerHTML = '<span class="loading-spin"></span> Salvando...'
  try {
    const patch = {
      cor_primaria:   _cfg.cor_primaria,
      cor_secundaria: _cfg.cor_secundaria,
      logo_base64:    _cfg.logo_base64,
      modelos:        _cfg.modelos
    }
    await window._saveTenantConfig(patch)
    window._applyTheme(patch)
    toast('Configurações salvas com sucesso!', 'success')
  } catch(e) {
    toast('Erro ao salvar: ' + e.message, 'error')
  } finally {
    btn.disabled = false
    btn.innerHTML = '💾 Salvar Configurações'
  }
}

// ============================================================
// COMPRESSÃO DE IMAGEM
// ============================================================
function compressImage(file, maxW, quality) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

// ============================================================
// TOAST
// ============================================================
let _toastTimer
function toast(msg, type='success') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = 'toast show ' + type
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500)
}