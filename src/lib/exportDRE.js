const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export function periodoFilename(periodos) {
  if (!periodos.length) return 'sem-periodo'
  if (periodos.length === 1) {
    const { ano, mes } = periodos[0]
    return `${ano}-${String(mes).padStart(2, '0')}`
  }
  const f = periodos[0]
  const l = periodos[periodos.length - 1]
  if (f.ano === l.ano) return `${MESES[f.mes - 1]}-${MESES[l.mes - 1]}-${f.ano}`
  return `${MESES[f.mes - 1]}${f.ano}-${MESES[l.mes - 1]}${l.ano}`
}

// ─── Color palette (dark-purple brand theme) ──────────────────────────────────
const C = {
  INK2:       'FF1a1a2e',
  DARK1:      'FF2a2535',
  DARK2:      'FF322d42',
  PURPLE:     'FF9b66f4',
  PURPLEL:    'FFb98af7',
  SUB_BG:     'FFede6ff',   // light lavender for subtotals
  ITEM_BG:    'FFF8F5FF',   // near-white for items
  TOTAL_BG:   'FFe8dcff',   // light purple for total row
  WHITE:      'FFFFFFFF',
  GRAY:       'FF555566',
  PURPLE_TXT: 'FF4a1f90',
  RED:        'FFCC2200',
}

function fill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function font(cell, opts) {
  cell.font = { name: 'Calibri', ...opts }
}

function alignR(cell) {
  cell.alignment = { horizontal: 'right', vertical: 'middle' }
}

function alignL(cell) {
  cell.alignment = { horizontal: 'left', vertical: 'middle' }
}

export async function exportDREToExcel({ linhas, periodos, dadosPorPeriodo, empresa }) {
  const { default: ExcelJS } = await import('exceljs')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'LUMA RH'
  wb.created = new Date()

  const ws = wb.addWorksheet('DRE', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    views: [{ showGridLines: false }],
  })

  const numCols = 1 + periodos.length + 1

  ws.columns = [
    { key: 'desc', width: 42 },
    ...periodos.map((_, i) => ({ key: `p${i}`, width: 16 })),
    { key: 'total', width: 17 },
  ]

  // ── Row 1: Title ─────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, numCols)
  const titleCell = ws.getCell('A1')
  titleCell.value = empresa
    ? `DRE – Demonstrativo de Resultado com Pessoal  |  ${empresa}`
    : 'DRE – Demonstrativo de Resultado com Pessoal'
  fill(titleCell, C.INK2)
  font(titleCell, { bold: true, size: 14, color: { argb: C.WHITE } })
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // ── Row 2: Period subtitle ────────────────────────────────────────────────────
  ws.mergeCells(2, 1, 2, numCols)
  const f = periodos[0]
  const l = periodos[periodos.length - 1]
  const rangeLabel = periodos.length === 1
    ? `Período: ${MESES[f.mes - 1].toUpperCase()}/${f.ano}`
    : `Período: ${MESES[f.mes - 1].toUpperCase()}/${f.ano} – ${MESES[l.mes - 1].toUpperCase()}/${l.ano}`
  const subCell = ws.getCell('A2')
  subCell.value = rangeLabel
  fill(subCell, C.INK2)
  font(subCell, { italic: true, size: 10, color: { argb: 'FFb09ad0' } })
  subCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 16

  // ── Row 3: Spacer ─────────────────────────────────────────────────────────────
  ws.getRow(3).height = 6
  for (let ci = 1; ci <= numCols; ci++) fill(ws.getCell(3, ci), C.INK2)

  // ── Row 4: Column headers ─────────────────────────────────────────────────────
  const hdrRow = ws.getRow(4)
  hdrRow.values = [
    'DESCRIÇÃO',
    ...periodos.map(p => `${MESES[p.mes - 1].toUpperCase()}/${String(p.ano).slice(2)}`),
    'TOTAL',
  ]
  hdrRow.height = 22
  hdrRow.eachCell((cell, ci) => {
    fill(cell, C.PURPLE)
    font(cell, { bold: true, size: 10, color: { argb: C.WHITE } })
    cell.alignment = { horizontal: ci === 1 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: C.PURPLEL } } }
  })

  // ── Data rows ──────────────────────────────────────────────────────────────────
  let rowIdx = 5

  for (const linha of linhas) {
    const row = ws.getRow(rowIdx++)

    if (linha.tipo === 'spacer') {
      row.height = 10
      for (let ci = 1; ci <= numCols; ci++) fill(ws.getCell(row.number, ci), C.INK2)
      continue
    }

    const isHeader   = linha.tipo === 'header'
    const isGroup    = linha.tipo === 'group'
    const isSubtotal = linha.tipo === 'subtotal'
    const isTotal    = linha.tipo === 'total'
    const isData     = isSubtotal || isTotal || linha.tipo === 'item'
    const isInt      = linha.fmt === 'int'

    // Build period values
    const periodVals = isData
      ? periodos.map(p => {
          const pd = dadosPorPeriodo[`${p.ano}-${p.mes}`]
          return pd ? (pd[linha.id] ?? null) : null
        })
      : periodos.map(() => null)

    // Build total column value
    let totalVal = null
    if (isData) {
      if (linha.id === 'hc_ativo') {
        const last = periodos[periodos.length - 1]
        totalVal = dadosPorPeriodo[`${last.ano}-${last.mes}`]?.hc_ativo ?? null
      } else if (linha.id === 'custo_medio') {
        const nonZero = periodVals.filter(v => v != null && v > 0)
        totalVal = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : null
      } else {
        const defined = periodVals.filter(v => v != null)
        totalVal = defined.length ? defined.reduce((a, b) => a + b, 0) : null
      }
    }

    // Label with visual indent
    const pad = '  '.repeat((linha.indent || 0) * 2)
    const label = isGroup ? `▸ ${linha.label}` : `${pad}${linha.label}`

    row.values = [label, ...periodVals, totalVal]

    // ── Row styling by type ────────────────────────────────────────────────────
    if (isHeader) {
      row.height = 22
      row.eachCell(cell => {
        fill(cell, C.INK2)
        font(cell, { bold: true, size: 11, color: { argb: C.WHITE } })
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FF4a3570' } },
          bottom: { style: 'thin', color: { argb: 'FF4a3570' } },
        }
      })
      alignL(ws.getCell(row.number, 1))

    } else if (isGroup) {
      row.height = 20
      row.eachCell(cell => {
        fill(cell, C.DARK1)
        font(cell, { bold: true, size: 10, color: { argb: 'FFc4b0e8' } })
      })
      alignL(ws.getCell(row.number, 1))

    } else if (isSubtotal) {
      row.height = 20
      row.eachCell(cell => {
        fill(cell, C.SUB_BG)
        font(cell, { bold: true, size: 10, color: { argb: C.PURPLE_TXT } })
        cell.border = { top: { style: 'hair', color: { argb: C.PURPLEL } } }
      })
      alignL(ws.getCell(row.number, 1))

    } else if (isTotal) {
      row.height = 24
      row.eachCell(cell => {
        fill(cell, C.TOTAL_BG)
        font(cell, { bold: true, size: 11, color: { argb: C.PURPLE } })
        cell.border = {
          top:    { style: 'medium', color: { argb: C.PURPLE } },
          bottom: { style: 'medium', color: { argb: C.PURPLE } },
        }
      })
      alignL(ws.getCell(row.number, 1))

    } else {
      row.height = 18
      row.eachCell(cell => {
        fill(cell, C.ITEM_BG)
        font(cell, { size: 10, color: { argb: C.GRAY } })
      })
      alignL(ws.getCell(row.number, 1))
    }

    // ── Value cell formatting ──────────────────────────────────────────────────
    if (isData) {
      for (let ci = 2; ci <= numCols; ci++) {
        const cell = ws.getCell(row.number, ci)
        if (cell.value == null) { cell.value = undefined; continue }
        alignR(cell)
        if (isInt) {
          cell.numFmt = '#,##0'
        } else {
          cell.numFmt = '"R$ "#,##0.00'
          if (typeof cell.value === 'number' && cell.value < 0) {
            const f = cell.font || {}
            cell.font = { ...f, color: { argb: C.RED } }
          }
        }
      }
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `DRE_${periodoFilename(periodos)}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
