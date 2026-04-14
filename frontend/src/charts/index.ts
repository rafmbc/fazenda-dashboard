import { Chart, registerables } from 'chart.js';
import { timeLabels, weekLabels, talhoes, getHumidityTimeSeries, getAllHumidityTimeSeries, getEnergyAccumulativeTimeSeries, getWeeklyEnergyData, getPowerFactorTimeSeries, getPowerImbalanceTimeSeries, getWeeklyTotalEnergyWh, getAveragePowerFactor, getMaxEnergyKwh, formatEnergyValue } from '../data/index.js';
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

// Smart energy formatter based on max value in period
function formatEnergyYAxis(valueInWh: number): string {
  const maxKwh = getMaxEnergyKwh();
  
  if (maxKwh >= 1) {
    // Format in kWh
    const valueInKwh = valueInWh / 1000;
    if (valueInKwh >= 1000) {
      return (valueInKwh / 1000).toFixed(1) + ' MWh';
    } else {
      return valueInKwh.toFixed(1) + ' kWh';
    }
  } else {
    // Format in Wh
    if (valueInWh >= 1000000) {
      return (valueInWh / 1000000).toFixed(1) + ' M Wh';
    } else if (valueInWh >= 10000) {
      return (valueInWh / 1000).toFixed(1) + ' k Wh';
    } else {
      return valueInWh.toFixed(2) + ' Wh';
    }
  }
}

// ============================================================
// MAIN CHARTS (sections: ger-overview, ger-energia, op-umidade)
// ============================================================
export function initCharts(): void {
  // -- Fator de Potência (ger-energia) --
  const pfSeries = getPowerFactorTimeSeries();
  const avgPowerFactor = getAveragePowerFactor();
  const POWER_FACTOR_LIMIT = 0.92;
  const isPowerFactorOk = avgPowerFactor >= POWER_FACTOR_LIMIT;
  destroy('fatorPotenciaChart');
  const fpInst = new Chart(canvas('fatorPotenciaChart'), {
    type: 'line',
    data: {
      labels: pfSeries.labels.length > 0 ? pfSeries.labels : timeLabels,
      datasets: [
        { label: 'Fator de Potência', data: pfSeries.data.length > 0 ? pfSeries.data : rand(0.90, 0.06, 24), borderColor: '#52c278', backgroundColor: 'rgba(82,194,120,0.08)', tension: 0.4, fill: false, pointRadius: 2, borderWidth: 2 },
        { label: 'Limite (0.92)', data: Array(pfSeries.labels.length > 0 ? pfSeries.labels.length : 24).fill(POWER_FACTOR_LIMIT), borderColor: 'rgba(232,69,69,0.85)', borderDash: [6, 3], borderWidth: 1.8, pointRadius: 0, fill: false, tension: 0 },
      ],
    },
    options: {
      ...defaults(),
      scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0, max: 1.0, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(2) } } },
    },
  });
  instances['fatorPotenciaChart'] = fpInst;
  const fpBadge = document.querySelector('#ger-energia .chart-card.chart-full .chart-badge');
  if (fpBadge) {
    fpBadge.className = isPowerFactorOk ? 'chart-badge badge-green' : 'chart-badge badge-red';
    fpBadge.textContent = isPowerFactorOk ? '✓ Normal > 0.92' : '⚠ Abaixo de 0.92';
  }
  const consumoKpi = document.querySelector('#ger-energia .kpi-grid .kpi-card:nth-child(1) .kpi-value');
  if (consumoKpi) {
    const totalWh = getWeeklyTotalEnergyWh();
    const maxKwh = getMaxEnergyKwh();
    let display = '';
    
    if (maxKwh >= 1) {
      // Display in kWh
      const totalKwh = totalWh / 1000;
      if (totalKwh >= 1000) {
        display = (totalKwh / 1000).toFixed(1) + '<span class="kpi-unit">MWh</span>';
      } else {
        display = totalKwh.toFixed(1) + '<span class="kpi-unit">kWh</span>';
      }
    } else {
      // Display in Wh
      if (totalWh >= 1000000) {
        display = (totalWh / 1000000).toFixed(1) + '<span class="kpi-unit">M Wh</span>';
      } else if (totalWh >= 10000) {
        display = (totalWh / 1000).toFixed(1) + '<span class="kpi-unit">k Wh</span>';
      } else {
        display = totalWh.toFixed(2) + '<span class="kpi-unit">Wh</span>';
      }
    }
    consumoKpi.innerHTML = display;
  }
  const fatorKpi = document.querySelector('#ger-energia .kpi-grid .kpi-card:nth-child(3) .kpi-value');
  if (fatorKpi) {
    fatorKpi.textContent = avgPowerFactor.toFixed(2);
  }
  const fatorTrend = document.querySelector('#ger-energia .kpi-grid .kpi-card:nth-child(3) .kpi-trend');
  if (fatorTrend) {
    const isBelowThreshold = avgPowerFactor < POWER_FACTOR_LIMIT;
    fatorTrend.className = isBelowThreshold ? 'kpi-trend trend-down' : 'kpi-trend trend-up';
    fatorTrend.textContent = isBelowThreshold ? '⚠ Abaixo de 0.92' : '✓ Eficiente';
  }

  // -- Energia Acumulada (ger-overview) — SEMANAL --
  const weeklyEnergySeries = getWeeklyEnergyData();
  const totalEnergyWh = getWeeklyTotalEnergyWh();
  destroy('energiaChart');
  instances['energiaChart'] = new Chart(canvas('energiaChart'), {
    type: 'line',
    data: {
      labels: weeklyEnergySeries.labels.length > 0 ? weeklyEnergySeries.labels : weekLabels,
      datasets: [{ data: weeklyEnergySeries.data.length > 0 ? weeklyEnergySeries.data.map(v => v * 1000) : [280000, 520000, 780000, 1020000, 1160000, 1280000, 1359000], borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.12)', tension: 0.15, fill: true, pointRadius: 4, borderWidth: 2, pointBackgroundColor: '#f0a500' }],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => formatEnergyYAxis(v as number) } } } },
  });
  const energiaBadge = document.querySelector('#ger-overview .two-col .chart-badge.badge-amber');
  if (energiaBadge) {
    energiaBadge.textContent = formatEnergyValue(totalEnergyWh / 1000) + ' total';
  }

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
  const hasEnergyTimeline = energyAccumSeries.timestamps.length > 0;
  const energyTimelineData = hasEnergyTimeline
    ? energyAccumSeries.timestamps.map((ts, i) => ({ x: ts, y: energyAccumSeries.data[i] * 1000 }))
    : cumsum(Array.from({ length: 24 }, (_, i) => 3000 + Math.sin(i / 3) * 1500 + Math.random() * 1000));
  destroy('energiaAcumChart');
  instances['energiaAcumChart'] = new Chart(canvas('energiaAcumChart'), {
    type: 'line',
    data: {
      labels: hasEnergyTimeline ? undefined : (energyAccumSeries.labels.length > 0 ? energyAccumSeries.labels : timeLabels),
      datasets: [{ data: energyTimelineData, borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.1)', tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2, pointBackgroundColor: '#f0a500', pointBorderColor: '#f0a500' }]
    },
    options: {
      ...defaults(),
      scales: {
        ...defaults().scales,
        x: hasEnergyTimeline
          ? {
              type: 'linear',
              grid: { color: colors().grid },
              ticks: {
                color: colors().tick,
                font: { family: 'Space Mono', size: 10 },
                maxTicksLimit: 6,
                callback: (v: unknown) => new Date(Number(v)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              },
            }
          : defaults().scales?.x,
        y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => formatEnergyYAxis(v as number) } },
      },
    },
  });

  // -- Desbalanceamento de Potência Ativa (ger-energia) --
  const desbalSeries = getPowerImbalanceTimeSeries();
  const hasDesbalTimeline = desbalSeries.timestamps.length > 0;
  const desbalA = hasDesbalTimeline ? desbalSeries.ab : rand(0, 60, 24);
  const desbalB = hasDesbalTimeline ? desbalSeries.bc : rand(30, 70, 24).map(v => -v);
  const desbalMax = Math.max(
    ...desbalA.filter((v): v is number => Number.isFinite(v)).map(Math.abs),
    ...desbalB.filter((v): v is number => Number.isFinite(v)).map(Math.abs),
    0,
  );
  destroy('desbalanceChart');
  instances['desbalanceChart'] = new Chart(canvas('desbalanceChart'), {
    type: 'bar',
    data: {
      labels: hasDesbalTimeline ? undefined : timeLabels,
      datasets: [
        {
          label: 'A–B',
          data: hasDesbalTimeline
            ? desbalSeries.timestamps.map((ts, idx) => ({ x: ts, y: Number.isFinite(desbalA[idx]) ? desbalA[idx] : null }))
            : desbalA,
          backgroundColor: desbalA.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(82,194,120,0.5)'),
          borderRadius: 3,
        },
        {
          label: 'B–C',
          data: hasDesbalTimeline
            ? desbalSeries.timestamps.map((ts, idx) => ({ x: ts, y: Number.isFinite(desbalB[idx]) ? desbalB[idx] : null }))
            : desbalB,
          backgroundColor: desbalB.map(v => Math.abs(v) > 50 ? 'rgba(232,69,69,0.7)' : 'rgba(74,158,255,0.5)'),
          borderRadius: 3,
        },
      ],
    },
    options: {
      ...defaults(),
      scales: {
        ...defaults().scales,
        x: hasDesbalTimeline
          ? {
              type: 'linear',
              grid: { color: colors().grid },
              ticks: {
                color: colors().tick,
                font: { family: 'Space Mono', size: 10 },
                maxTicksLimit: 6,
                callback: (v: unknown) => new Date(Number(v)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              },
            }
          : defaults().scales?.x,
        y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + ' W' } },
      },
    },
  });
  const desbalKpiVal = document.querySelector('#ger-energia .kpi-grid .kpi-card:nth-child(2) .kpi-value');
  if (desbalKpiVal) desbalKpiVal.innerHTML = Math.round(desbalMax) + '<span class="kpi-unit">W</span>';

  // -- Umidade por Talhão (op-umidade) --
  const umColors = ['#52c278', '#4a9eff', '#c8e63a', '#f0a500', '#e84545'];
  const selected = ['A1', 'B2', 'C3', 'D4', 'E5'];
  const humiditySeries = getAllHumidityTimeSeries(selected);
  const hasRealHumidityData = humiditySeries.labels.length > 0;
  const hasHumidityTimeline = humiditySeries.timestamps.length > 0;
  const umDatasets = selected.map((name, i) => {
    const talhaoBase = talhoes.find(t => t.id === name)?.umidade ?? 50;
    const dataPoints = hasRealHumidityData
      ? (hasHumidityTimeline
          ? humiditySeries.timestamps.map((ts, idx) => {
              const y = humiditySeries.series[name]?.[idx];
              return { x: ts, y: Number.isFinite(y as number) ? y as number : null };
            })
          : (humiditySeries.series[name] ?? []))
      : rand(talhaoBase, 10, timeLabels.length);

    return {
      label: `Talhão ${name}`,
      data: dataPoints,
      borderColor: umColors[i],
      backgroundColor: umColors[i] + '18',
      tension: 0.25,
      fill: false,
      pointRadius: 1,
      borderWidth: 2,
      spanGaps: true,
    };
  });

  const umLegend = document.getElementById('umidade-legend');
  if (umLegend) {
    umLegend.innerHTML = selected.map((n, i) =>
      `<div class="legend-item"><div class="legend-dot" style="background:${umColors[i]}"></div>Talhão ${n}</div>`
    ).join('');
  }

  const umLabels = hasRealHumidityData ? humiditySeries.labels : timeLabels;

  destroy('umidadeChart');
  instances['umidadeChart'] = new Chart(canvas('umidadeChart'), {
    type: 'line',
    data: {
      labels: hasHumidityTimeline ? undefined : (umLabels.length > 0 ? umLabels : timeLabels),
      datasets: umDatasets,
    },
    options: {
      ...defaults(),
      plugins: { ...defaults().plugins, legend: { display: false } },
      scales: {
        ...defaults().scales,
        x: hasHumidityTimeline
          ? {
              type: 'linear',
              grid: { color: colors().grid },
              ticks: {
                color: colors().tick,
                font: { family: 'Space Mono', size: 10 },
                maxTicksLimit: 6,
                callback: (v: unknown) => new Date(Number(v)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              },
            }
          : defaults().scales?.x,
        y: {
          ...defaults().scales!['y'],
          min: 0,
          max: 100,
          ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => v + '%' },
        },
      },
    },
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
        { label: 'Limite (0.92)', data: Array(fpLabels.length).fill(0.92), borderColor: 'rgba(232,69,69,0.85)', borderDash: [5, 3], pointRadius: 0, fill: false, tension: 0, borderWidth: 1.8 },
      ],
    },
    options: { ...defaults(), scales: { ...defaults().scales, y: { ...defaults().scales!['y'], min: 0, max: 1.0, ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => (v as number).toFixed(2) } } } },
  });

  const detailEnergySeries = getEnergyAccumulativeTimeSeries();
  const hasDetailEnergyTimeline = detailEnergySeries.timestamps.length > 0;
  const enRaw = hasDetailEnergyTimeline
    ? detailEnergySeries.data
    : (energiaRows?.length ? energiaRows.map(r => parseFloat(r[maps.kwh] ?? '0') || 0).slice(0, 24) : cumsum(Array.from({ length: 24 }, () => 3 + Math.sin(Math.random() * 3) * 1.5)));
  destroy('det-energiaAcum');
  instances['det-energiaAcum'] = new Chart(canvas('det-energiaAcum'), {
    type: 'line',
    data: {
      labels: hasDetailEnergyTimeline ? undefined : fpLabels,
      datasets: [{
        data: hasDetailEnergyTimeline
          ? detailEnergySeries.timestamps.map((ts, idx) => ({ x: ts, y: (enRaw[idx] ?? 0) * 1000 }))
          : enRaw.map(v => v * 1000),
        borderColor: '#f0a500',
        backgroundColor: 'rgba(240,165,0,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        borderWidth: 2,
      }],
    },
    options: {
      ...defaults(),
      scales: {
        ...defaults().scales,
        x: hasDetailEnergyTimeline
          ? {
              type: 'linear',
              grid: { color: colors().grid },
              ticks: {
                color: colors().tick,
                font: { family: 'Space Mono', size: 10 },
                maxTicksLimit: 6,
                callback: (v: unknown) => new Date(Number(v)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              },
            }
          : defaults().scales?.x,
        y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => formatEnergyYAxis(v as number) } },
      },
    },
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

  // Destroy and recreate the chart to ensure clean state
  destroy('energiaAcumChart');
  const energyAccumSeries = getEnergyAccumulativeTimeSeries();
  const hasEnergyTimeline = energyAccumSeries.timestamps.length > 0;
  const newData = hasEnergyTimeline
    ? energyAccumSeries.timestamps.map((ts, i) => ({ x: ts, y: energyAccumSeries.data[i] * 1000 }))
    : (energyAccumSeries.data.length > 0 ? energyAccumSeries.data.map(v => v * 1000) : cumsum(Array.from({ length: 24 }, () => 2500 + Math.random() * 2500)));
  const newLabels = energyAccumSeries.labels.length > 0 ? energyAccumSeries.labels : timeLabels;
  const borderColor = tab === 'iluminacao' ? '#f0a500' : '#4a9eff';
  const backgroundColor = tab === 'iluminacao' ? 'rgba(240,165,0,0.1)' : 'rgba(74,158,255,0.1)';
  
  instances['energiaAcumChart'] = new Chart(canvas('energiaAcumChart'), {
    type: 'line',
    data: {
      labels: hasEnergyTimeline ? undefined : newLabels,
      datasets: [{ data: newData, borderColor, backgroundColor, tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2, pointBackgroundColor: borderColor, pointBorderColor: borderColor }]
    },
    options: {
      ...defaults(),
      scales: {
        ...defaults().scales,
        x: hasEnergyTimeline
          ? {
              type: 'linear',
              grid: { color: colors().grid },
              ticks: {
                color: colors().tick,
                font: { family: 'Space Mono', size: 10 },
                maxTicksLimit: 6,
                callback: (v: unknown) => new Date(Number(v)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              },
            }
          : defaults().scales?.x,
        y: { ...defaults().scales!['y'], ticks: { ...(defaults().scales!['y'] as { ticks?: object }).ticks, callback: (v: unknown) => formatEnergyYAxis(v as number) } },
      },
    },
  });
}
