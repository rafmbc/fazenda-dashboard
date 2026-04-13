import { Chart, registerables } from 'chart.js';
import { timeLabels, weekLabels, talhoes, getHumidityTimeSeries, getEnergyAccumulativeTimeSeries, getWeeklyEnergyData, getPowerFactorTimeSeries } from '../data/index.js';
import { rand, cumsum, isDarkTheme } from '../utils/helpers.js';
import { realData, realMaps } from '../utils/upload.js';

Chart.register(...registerables);

// ============================================================
// CHART INSTANCE REGISTRY
// ============================================================
const instances: Record<string, Chart> = {};

function destroy(id: string): void {
  if (instances[id]) {
    instances[id].destroy();
    delete instances[id];
  }
}

// ============================================================
// THEME-AWARE DEFAULTS
// ============================================================
function colors() {
  const dark = isDarkTheme();
  return {
    grid:    dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    tick:    dark ? '#4d7a5e'               : '#7aaa8a',
    tooltip: dark ? '#122b1b'               : '#ffffff',
    body:    dark ? '#e8f5ee'               : '#0d2b1a',
  };
}

function defaults(): Chart['options'] {
  const c = colors();
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.tooltip,
        titleColor: '#52c278',
        bodyColor: c.body,
        borderColor: 'rgba(52,154,90,0.3)',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: 'Space Mono', size: 11 },
        bodyFont: { family: 'DM Sans', size: 12 },
      },
    },
    scales: {
      x: {
        grid: { color: c.grid },
        ticks: { color: c.tick, font: { family: 'Space Mono', size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: c.grid },
        ticks: { color: c.tick, font: { family: 'Space Mono', size: 10 } },
      },
    },
  };
}

function canvas(id: string): HTMLCanvasElement {
  return document.getElementById(id) as HTMLCanvasElement;
}

// ============================================================
// MAIN CHARTS (sections: ger-overview, ger-energia, op-umidade)
// ============================================================
export function initCharts(): void {
  // -- Fator de Potência (ger-energia) --
  const pfSeries = getPowerFactorTimeSeries();
  destroy('fatorPotenciaChart');
  const fpInst = new Chart(canvas('fatorPotenciaChart'), {
    type: 'line',
    data: {
      labels: pfSeries.labels.length > 0 ? pfSeries.labels : timeLabels,
      datasets: [
        { label: 'Fator de Potência', data: pfSeries.data.length > 0 ? pfSeries.data : rand(0.90, 0.06, 24), borderColor: '#52c278', backgroundColor: 'rgba(82,194,120,0.08)', tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2 },
        { label: 'Limite (0.85)', data: Array(pfSeries.labels.length > 0 ? pfSeries.labels.length : 24).fill(0.85), borderColor: 'rgba(232,69,69,0.6)', borderDash: [6, 3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0 },
      ],
    },
    options: {
      ...defaults(),
      scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0.7, max: 1.0, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(2) } } },
    },
  });
  instances['fatorPotenciaChart'] = fpInst;

  // -- Energia Acumulada (ger-overview) — SEMANAL --
  const weeklyEnergySeries = getWeeklyEnergyData();
  destroy('energiaChart');
  instances['energiaChart'] = new Chart(canvas('energiaChart'), {
    type: 'line',
    data: {
      labels: weeklyEnergySeries.labels.length > 0 ? weeklyEnergySeries.labels : weekLabels,
      datasets: [{ data: weeklyEnergySeries.data.length > 0 ? weeklyEnergySeries.data : [280, 520, 780, 1020, 1160, 1280, 1359], borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.12)', tension: 0.4, fill: true, pointRadius: 4, borderWidth: 2, pointBackgroundColor: '#f0a500' }],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + ' kWh' } } } },
  });

  // -- Eficiência Produtiva (ger-overview) --
  destroy('eficienciaChart');
  instances['eficienciaChart'] = new Chart(canvas('eficienciaChart'), {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: [{ data: [0.61, 0.64, 0.67, 0.68, 0.70, 0.71, 0.72], backgroundColor: weekLabels.map((_, i) => `rgba(58,156,90,${0.4 + i * 0.09})`), borderRadius: 6, borderSkipped: false }],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0.5, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(2) } } } },
  });

  // -- Energia Acumulada (ger-energia) — HORÁRIA --
  const energyAccumSeries = getEnergyAccumulativeTimeSeries();
  destroy('energiaAcumChart');
  instances['energiaAcumChart'] = new Chart(canvas('energiaAcumChart'), {
    type: 'line',
    data: {
      labels: energyAccumSeries.labels.length > 0 ? energyAccumSeries.labels : timeLabels,
      datasets: [{ data: energyAccumSeries.data.length > 0 ? energyAccumSeries.data : cumsum(Array.from({ length: 24 }, (_, i) => 3 + Math.sin(i / 3) * 1.5 + Math.random())), borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.1)', tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2 }]
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(0) + ' kWh' } } } },
  });

  // -- Desbalanceamento de Potência Ativa (ger-energia) --
  const desbalA = rand(0, 60, 24);
  const desbalB = rand(30, 70, 24).map(v => -v);
  destroy('desbalanceChart');
  instances['desbalanceChart'] = new Chart(canvas('desbalanceChart'), {
    type: 'bar',
    data: {
      labels: timeLabels,
      datasets: [
        { label: 'A–B', data: desbalA, backgroundColor: desbalA.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(82,194,120,0.5)'), borderRadius: 3 },
        { label: 'B–C', data: desbalB, backgroundColor: desbalB.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(74,158,255,0.5)'), borderRadius: 3 },
      ],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + ' W' } } } },
  });

  // -- Umidade por Talhão (op-umidade) --
  const umColors = ['#52c278', '#4a9eff', '#c8e63a', '#f0a500', '#e84545'];
  const selected = ['A1', 'B2', 'C3', 'D4', 'E5'];
  const umDatasets = selected.map((name, i) => {
    const series = getHumidityTimeSeries(name);
    return { label: `Talhão ${name}`, data: series.data, borderColor: umColors[i], backgroundColor: umColors[i] + '18', tension: 0.4, fill: false, pointRadius: 1, borderWidth: 2 };
  });

  const umLegend = document.getElementById('umidade-legend');
  if (umLegend) {
    umLegend.innerHTML = selected.map((n, i) =>
      `<div class="legend-item"><div class="legend-dot" style="background:${umColors[i]}"></div>Talhão ${n}</div>`
    ).join('');
  }

  const umLabels = getHumidityTimeSeries('A1').labels; // Assume same labels

  destroy('umidadeChart');
  instances['umidadeChart'] = new Chart(canvas('umidadeChart'), {
    type: 'line',
    data: { labels: umLabels.length > 0 ? umLabels : timeLabels, datasets: umDatasets },
    options: { ...defaults(), plugins: { ...defaults().plugins, legend: { display: false } }, scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0, max: 100, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + '%' } } } },
  });
}

// ============================================================
// TALHÃO DETAIL CHARTS
// ============================================================
export function renderDetailCharts(talhaoId: string): void {
  const t = talhoes.find(x => x.id === talhaoId);
  if (!t) return;

  const energiaRows = realData.energia;
  const maps = realMaps.energia;

  const pfDetailSeries = getPowerFactorTimeSeries();
  const fpLabels = pfDetailSeries.labels.length > 0 ? pfDetailSeries.labels : timeLabels;
  const fpData = pfDetailSeries.data.length > 0 ? pfDetailSeries.data : rand(0.88, 0.07, 24);

  destroy('det-fatorPotencia');
  instances['det-fatorPotencia'] = new Chart(canvas('det-fatorPotencia'), {
    type: 'line',
    data: {
      labels: fpLabels,
      datasets: [
        { label: 'Fator de Potência', data: fpData, borderColor: '#52c278', backgroundColor: 'rgba(82,194,120,0.08)', tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2 },
        { label: 'Limite', data: Array(fpLabels.length).fill(0.85), borderColor: 'rgba(232,69,69,0.5)', borderDash: [5, 3], pointRadius: 0, fill: false, tension: 0, borderWidth: 1.5 },
      ],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0.7, max: 1.0, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(2) } } } },
  });

  const enRaw = energiaRows?.length ? energiaRows.map(r => parseFloat(r[maps.kwh] ?? '0') || 0).slice(0, 24) : cumsum(Array.from({ length: 24 }, () => 3 + Math.sin(Math.random() * 3) * 1.5));
  destroy('det-energiaAcum');
  instances['det-energiaAcum'] = new Chart(canvas('det-energiaAcum'), {
    type: 'line',
    data: { labels: fpLabels, datasets: [{ data: enRaw, borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.1)', tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2 }] },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(1) + ' kWh' } } } },
  });

  const dabRaw = energiaRows?.length ? energiaRows.map(r => parseFloat(r[maps.dab] ?? '0') || 0).slice(0, 24) : rand(0, 60, 24);
  const dbcRaw = energiaRows?.length ? energiaRows.map(r => parseFloat(r[maps.dbc] ?? '0') || 0).slice(0, 24) : rand(30, 70, 24).map(v => -v);
  destroy('det-desbalance');
  instances['det-desbalance'] = new Chart(canvas('det-desbalance'), {
    type: 'bar',
    data: {
      labels: fpLabels,
      datasets: [
        { label: 'A–B', data: dabRaw, backgroundColor: dabRaw.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(82,194,120,0.5)'), borderRadius: 3 },
        { label: 'B–C', data: dbcRaw, backgroundColor: dbcRaw.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(74,158,255,0.5)'), borderRadius: 3 },
      ],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + ' W' } } } },
  });

  const umSeries = getHumidityTimeSeries(t.id);
  let umVals: number[];
  let umLbls: string[];
  if (umSeries.data.length > 0) {
    umVals = umSeries.data;
    umLbls = umSeries.labels;
  } else {
    umVals = rand(t.umidade, 12, 24);
    umLbls = timeLabels;
  }

  destroy('det-umidade');
  instances['det-umidade'] = new Chart(canvas('det-umidade'), {
    type: 'line',
    data: {
      labels: umLbls,
      datasets: [
        { label: 'Umidade', data: umVals, borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,0.1)', tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2 },
        { label: 'Lim. min', data: Array(umLbls.length).fill(30), borderColor: 'rgba(232,69,69,0.5)', borderDash: [5, 3], pointRadius: 0, fill: false, tension: 0, borderWidth: 1.5 },
        { label: 'Lim. max', data: Array(umLbls.length).fill(70), borderColor: 'rgba(74,158,255,0.5)', borderDash: [5, 3], pointRadius: 0, fill: false, tension: 0, borderWidth: 1.5 },
      ],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0, max: 100, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + '%' } } } },
  });
}

// ============================================================
// ENERGY TAB SWITCH
// ============================================================
export function switchEnergyTab(tab: string, btn: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.etab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const badge = document.getElementById('energia-tipo-badge');
  if (badge) badge.textContent = tab === 'iluminacao' ? 'Iluminação' : 'Sistemas';

  const inst = instances['energiaAcumChart'];
  if (inst && inst.data && inst.data.datasets && inst.data.datasets.length > 0) {
    try {
      const newData = cumsum(Array.from({ length: 24 }, () => 2.5 + Math.random() * 2.5));
      const dataset = inst.data.datasets[0] as any;
      dataset.data = newData;
      dataset.borderColor = tab === 'iluminacao' ? '#f0a500' : '#4a9eff';
      dataset.backgroundColor = tab === 'iluminacao' ? 'rgba(240,165,0,0.1)' : 'rgba(74,158,255,0.1)';
      inst.update();
    } catch (e) {
      console.error('Error updating energy chart:', e);
    }
  }
}
