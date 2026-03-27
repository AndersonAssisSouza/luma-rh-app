// migrate_exames.cjs — migra exames ocupacionais do Excel para Supabase
// Uso: cd scripts && node migrate_exames.cjs
const XLSX = require('xlsx');

const EXCEL_PATH = 'C:\\Users\\ander\\OneDrive - Luisa Moraes Advogados\\Controle Geral\\Recursos Humanos\\Base Controle RH\\Base_RH_Estruturada_v4_automacao.xlsx';
const SB_URL  = 'https://ttclcdppifmmdjztfunl.supabase.co';
const SB_SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Y2xjZHBwaWZtbWRqenRmdW5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUzNjg4OCwiZXhwIjoyMDkwMTEyODg4fQ.OGYi5aNnXIyZdQbK3I7e-_GICcClzHd9G2hZZS0dx1g';
const TENANT  = 'e257a9cf-d443-44d2-abdc-845d8f38a189';

const HDR = { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, 'Content-Type': 'application/json' };

function parseDate(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (v.match(/^\d{4}-\d{2}-\d{2}/)) return v.slice(0, 10);
  }
  return null;
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function sbGet(path) {
  const r = await fetch(SB_URL + path, { headers: HDR });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(SB_URL + path, {
    method: 'POST',
    headers: { ...HDR, Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
}

async function run() {
  console.log('\n=== Migração de Exames Ocupacionais ===\n');

  // Lê Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets['EXAMES_OCUPACIONAIS'];
  if (!ws) {
    // Tenta listar abas disponíveis para ajudar no diagnóstico
    console.error('Aba EXAMES_OCUPACIONAIS não encontrada!');
    console.log('Abas disponíveis:', wb.SheetNames.join(', '));
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`Excel: ${rows.length} linhas na aba EXAMES_OCUPACIONAIS`);

  if (rows.length === 0) {
    console.log('Planilha vazia. Nada a migrar.');
    return;
  }

  // Mostra colunas disponíveis para diagnóstico
  console.log('Colunas encontradas:', Object.keys(rows[0]).join(', '));

  // Filtra linhas válidas — precisa ter ao menos nome e tipo de exame
  const rawEx = rows.filter(r => {
    const nome = norm(r.NOME || r['NOME DO COLABORADOR'] || r.Colaborador || r.Nome || '');
    const tipo = norm(
      r.TIPO_EXAME || r['TIPO DE EXAME'] || r['TIPO EXAME'] || r.Tipo || r.TipoExame || ''
    );
    return nome && nome !== 'colaborador (a)' && nome !== 'colaborador' && nome !== 'nome' && tipo;
  });
  console.log(`Válidas após filtro: ${rawEx.length}`);

  if (rawEx.length === 0) {
    console.log('\nNenhum registro válido encontrado.');
    if (rows.length > 0) console.log('Exemplo de linha:', JSON.stringify(rows[0]));
    return;
  }

  // Busca colaboradores ATIVOS do Supabase para fazer o matching
  console.log('\nBuscando colaboradores ativos do Supabase...');
  const colabs = await sbGet(
    `/rest/v1/colaboradores?tenant_id=eq.${TENANT}&select=id,nome,id_colaborador,status`
  );
  console.log(`${colabs.length} colaboradores ativos encontrados`);

  // Cria mapas: nome normalizado → colaborador  e  id_colaborador → colaborador
  const colabMap = new Map();
  const colabIdMap = new Map();
  colabs.forEach(c => {
    colabMap.set(norm(c.nome), c);
    const firstName = norm(c.nome).split(' ')[0];
    if (!colabMap.has(firstName)) colabMap.set(firstName, c);
    if (c.id_colaborador) colabIdMap.set(String(c.id_colaborador).trim().toUpperCase(), c);
  });

  let ok = 0, skip = 0, noMatch = 0;
  const inserts = [];

  for (const r of rawEx) {
    const nomeRaw = String(
      r.NOME || r['NOME DO COLABORADOR'] || r.Colaborador || r.Nome || ''
    ).trim();

    const tipoExame = String(
      r.TIPO_EXAME || r['TIPO DE EXAME'] || r['TIPO EXAME'] || r.Tipo || r.TipoExame || ''
    ).trim() || null;

    const ultimoExame = parseDate(
      r.ULTIMO_EXAME || r['ULTIMO EXAME'] || r['DATA ULTIMO EXAME'] || r.UltimoExame || r['Último Exame'] || null
    );

    const proximoExame = parseDate(
      r.PROXIMO_EXAME || r['PROXIMO EXAME'] || r['DATA PROXIMO EXAME'] || r.ProximoExame || r['Próximo Exame'] || null
    );

    const statusExame = String(
      r.STATUS_EXAME || r['STATUS EXAME'] || r.Status || r.StatusExame || ''
    ).trim() || null;

    const observacao = String(
      r.OBSERVACAO || r.Observação || r.Observacao || r.OBS || ''
    ).trim() || null;

    if (!nomeRaw) { skip++; continue; }

    // Matching por ID_COLABORADOR do Excel (mais confiável)
    const idColabExcel = String(r.ID_COLABORADOR || '').trim().toUpperCase();
    let colab = idColabExcel ? colabIdMap.get(idColabExcel) : null;

    // Fallback: matching por nome exato normalizado
    if (!colab) colab = colabMap.get(norm(nomeRaw));

    // Fallback: matching por primeiro + último nome
    if (!colab) {
      const parts = norm(nomeRaw).split(' ');
      if (parts.length >= 2) {
        for (const [key, c] of colabMap) {
          const kParts = key.split(' ');
          if (kParts[0] === parts[0] && kParts[kParts.length - 1] === parts[parts.length - 1]) {
            colab = c;
            break;
          }
        }
      }
    }

    if (!colab) {
      console.warn(`  ⚠ Sem match: "${nomeRaw}"`);
      noMatch++;
      continue;
    }

    inserts.push({
      tenant_id:      TENANT,
      colaborador_id: colab.id,
      tipo_exame:     tipoExame,
      ultimo_exame:   ultimoExame,
      proximo_exame:  proximoExame,
      status_exame:   statusExame,
      observacao:     observacao
    });
    ok++;
  }

  if (inserts.length === 0) {
    console.log(`\nNenhum registro para inserir. Sem match: ${noMatch}, Inválidos: ${skip}`);
    return;
  }

  console.log(`\nInserindo ${inserts.length} registros de exames...`);

  // Limpa registros antigos do tenant antes de reinserir (evita duplicatas)
  console.log('Removendo registros anteriores do tenant...');
  const delR = await fetch(
    `${SB_URL}/rest/v1/exames_ocupacionais?tenant_id=eq.${TENANT}`,
    { method: 'DELETE', headers: HDR }
  );
  if (!delR.ok) {
    const txt = await delR.text();
    console.warn(`Aviso ao limpar: ${delR.status}: ${txt}`);
  } else {
    console.log('  ✓ Registros anteriores removidos');
  }

  // Insere em lotes de 50
  const BATCH = 50;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH);
    await sbPost('/rest/v1/exames_ocupacionais', batch);
    console.log(`  ✓ Lote ${Math.floor(i / BATCH) + 1}: ${batch.length} registros`);
  }

  console.log(`\n✅ Concluído!`);
  console.log(`   Inseridos:          ${ok}`);
  console.log(`   Sem match de nome:  ${noMatch}`);
  console.log(`   Inválidos/pulados:  ${skip}`);
}

run().catch(e => { console.error('Erro fatal:', e); process.exit(1); });
