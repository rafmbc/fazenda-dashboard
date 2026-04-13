// ============================================================
// DATA UPLOAD & PARSING
// ============================================================

export type RawRow = Record<string, string>;

export interface RealData {
  energia: RawRow[] | null;
  umidade: { talhoes: Record<string, { values: number[]; labels: string[] }> } | null;
  ndvi: RawRow[] | null;
}

export interface RealMaps {
  energia: { ts: string; fa: string; fb: string; fc: string; kwh: string; dab: string; dbc: string };
  umidade: { ts: string; val: string; talhao: string };
  ndvi: { id: string; val: string; um: string; en: string };
}

export const realData: RealData = { energia: null, umidade: null, ndvi: null };
export const realMaps: RealMaps = {
  energia: { ts: '', fa: '', fb: '', fc: '', kwh: '', dab: '', dbc: '' },
  umidade: { ts: '', val: '', talhao: '' },
  ndvi:    { id: '', val: '', um: '', en: '' },
};
export const parsedFiles: Record<string, RawRow[] | null> = { energia: null, umidade: null, ndvi: null };

export function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: RawRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

export function parseJSON(text: string): RawRow[] {
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) return data as RawRow[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const val = obj['data'] ?? obj['records'] ?? Object.values(obj)[0];
    if (Array.isArray(val)) return val as RawRow[];
  }
  return [];
}

// Auto-detect column names
const AUTO_MAP: Record<string, string[]> = {
  'map-energia-ts':  ['timestamp','time','hora','datetime','data','date'],
  'map-energia-fa':  ['fator_a','fp_a','pfa','factor_a','fator_potencia_a','fp_fase_a'],
  'map-energia-fb':  ['fator_b','fp_b','pfb','factor_b','fator_potencia_b','fp_fase_b'],
  'map-energia-fc':  ['fator_c','fp_c','pfc','factor_c','fator_potencia_c','fp_fase_c'],
  'map-energia-kwh': ['energia_kwh','energia','kwh','energy','kWh','energia_acumulada'],
  'map-energia-dab': ['desbal_ab','desbalanceamento_ab','desbal_a_b','pot_ab','delta_ab'],
  'map-energia-dbc': ['desbal_bc','desbalanceamento_bc','desbal_b_c','pot_bc','delta_bc'],
  'map-umidade-ts':  ['timestamp','time','hora','datetime','data'],
  'map-umidade-val': ['umidade','humidity','soil_moisture','umidade_pct','moisture'],
  'map-umidade-talhao': ['talhao','talhão','field','area','setor','parcela'],
  'map-ndvi-id':  ['talhao','talhão','field','area','id','parcela'],
  'map-ndvi-val': ['ndvi','ndvi_value','vigor','index'],
  'map-ndvi-um':  ['umidade','humidity','moisture'],
  'map-ndvi-en':  ['energia_kwh','energia','kwh','energy'],
};

const SELECT_IDS: Record<string, string[]> = {
  energia: ['map-energia-ts','map-energia-fa','map-energia-fb','map-energia-fc','map-energia-kwh','map-energia-dab','map-energia-dbc'],
  umidade: ['map-umidade-ts','map-umidade-val','map-umidade-talhao'],
  ndvi:    ['map-ndvi-id','map-ndvi-val','map-ndvi-um','map-ndvi-en'],
};

export function fillSelects(type: string, headers: string[]): void {
  (SELECT_IDS[type] ?? []).forEach(selectId => {
    const sel = document.getElementById(selectId) as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Nenhum --</option>' +
      headers.map(h => `<option value="${h}">${h}</option>`).join('');
    const candidates = AUTO_MAP[selectId] ?? [];
    for (const c of candidates) {
      const match = headers.find(h => h.toLowerCase() === c.toLowerCase());
      if (match) { sel.value = match; break; }
    }
  });
  document.getElementById(`mapper-${type}`)?.classList.add('visible');
}

export function openUploadModal(): void {
  document.getElementById('upload-modal-overlay')?.classList.add('open');
}

export function closeUploadModal(): void {
  document.getElementById('upload-modal-overlay')?.classList.remove('open');
}

export function switchUploadTab(tab: string, btn: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.utab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll<HTMLElement>('.upload-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`upanel-${tab}`)?.classList.add('active');
}

export function handleFile(type: string, input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    let rows: RawRow[];
    try {
      rows = file.name.endsWith('.json') ? parseJSON(text) : parseCSV(text);
    } catch (err) {
      alert('Erro ao ler o arquivo: ' + (err as Error).message);
      return;
    }
    if (!rows.length) { alert('Arquivo vazio ou formato inválido.'); return; }
    parsedFiles[type] = rows;
    const headers = Object.keys(rows[0]);

    // Preview table (first 5 rows)
    const prev = document.getElementById(`prev-${type}`);
    if (prev) {
      prev.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-bottom:4px;">
          ${rows.length} linhas · ${headers.length} colunas
        </div>
        <div style="overflow-x:auto;max-height:120px;">
          <table style="border-collapse:collapse;width:100%;font-size:11px;">
            <tr>${headers.map(h => `<th style="padding:4px 8px;border:1px solid var(--border-color);color:var(--green-400);font-family:var(--font-mono);">${h}</th>`).join('')}</tr>
            ${rows.slice(0, 5).map(r =>
              `<tr>${headers.map(h => `<td style="padding:4px 8px;border:1px solid var(--border-color);color:var(--text-secondary);">${r[h]}</td>`).join('')}</tr>`
            ).join('')}
          </table>
        </div>`;
      prev.classList.add('visible');
    }

    fillSelects(type, headers);
    const applyBtn = document.getElementById(`apply-${type}`) as HTMLButtonElement | null;
    if (applyBtn) applyBtn.disabled = false;
  };
  reader.readAsText(file);
}

export function applyData(type: string): void {
  const rows = parsedFiles[type];
  if (!rows) return;

  if (type === 'energia') {
    const getVal = (id: string) => (document.getElementById(id) as HTMLSelectElement)?.value ?? '';
    realMaps.energia = {
      ts:  getVal('map-energia-ts'),
      fa:  getVal('map-energia-fa'),
      fb:  getVal('map-energia-fb'),
      fc:  getVal('map-energia-fc'),
      kwh: getVal('map-energia-kwh'),
      dab: getVal('map-energia-dab'),
      dbc: getVal('map-energia-dbc'),
    };
    realData.energia = rows;
  }

  if (type === 'umidade') {
    const tsCol     = (document.getElementById('map-umidade-ts') as HTMLSelectElement)?.value ?? '';
    const valCol    = (document.getElementById('map-umidade-val') as HTMLSelectElement)?.value ?? '';
    const talhaoCol = (document.getElementById('map-umidade-talhao') as HTMLSelectElement)?.value ?? '';
    realMaps.umidade = { ts: tsCol, val: valCol, talhao: talhaoCol };

    // Group by talhao
    const grouped: Record<string, { values: number[]; labels: string[] }> = {};
    rows.forEach(r => {
      const tid = r[talhaoCol] ?? 'unknown';
      if (!grouped[tid]) grouped[tid] = { values: [], labels: [] };
      grouped[tid].values.push(parseFloat(r[valCol] ?? '0') || 0);
      grouped[tid].labels.push(r[tsCol] ?? '');
    });
    realData.umidade = { talhoes: grouped };
  }

  if (type === 'ndvi') {
    const idCol  = (document.getElementById('map-ndvi-id') as HTMLSelectElement)?.value ?? '';
    const valCol = (document.getElementById('map-ndvi-val') as HTMLSelectElement)?.value ?? '';
    const umCol  = (document.getElementById('map-ndvi-um') as HTMLSelectElement)?.value ?? '';
    const enCol  = (document.getElementById('map-ndvi-en') as HTMLSelectElement)?.value ?? '';
    realMaps.ndvi = { id: idCol, val: valCol, um: umCol, en: enCol };
    realData.ndvi = rows;

    // Patch talhoes array with real values
    rows.forEach(r => {
      const { talhoes } = window as unknown as { talhoes: Array<{ id: string; ndvi: number; umidade: number; energia: number }> };
      const t = talhoes.find(x => x.id === r[idCol]);
      if (t) {
        if (valCol && r[valCol]) t.ndvi    = parseFloat(r[valCol]);
        if (umCol  && r[umCol])  t.umidade = parseFloat(r[umCol]);
        if (enCol  && r[enCol])  t.energia = parseFloat(r[enCol]);
      }
    });
  }

  const succ = document.getElementById(`succ-${type}`);
  succ?.classList.add('visible');
  setTimeout(() => succ?.classList.remove('visible'), 3500);
  closeUploadModal();

  // Re-render everything
  (window as unknown as { initCharts: () => void }).initCharts?.();
}
