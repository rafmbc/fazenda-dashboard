import { talhoes, alerts as alertsData, anomalias, type AlertItem, getWeeklyTotalEnergyWh } from '../data/index.js';
import { getNdviColor } from '../utils/helpers.js';
import { renderDetailCharts } from '../charts/index.js';
import { interventionHistory, actionSuggestions } from '../data/index.js';
import { goToSection } from './navigation.js';

// ============================================================
// TALHÃO MAP
// ============================================================
export function renderTalhaoMap(containerId: string): void {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  talhoes.forEach(t => {
    const el = document.createElement('div');
    el.className = `talhao-cell status-${t.status}`;
    el.style.background = getNdviColor(t.ndvi) + '55';
    el.style.borderColor = getNdviColor(t.ndvi) + '88';
    el.innerHTML = `
      <div class="t-name">${t.id}</div>
      <div class="t-ndvi">${t.ndvi}</div>
      ${t.alerts > 0 ? `<div class="t-alert">${t.alerts}</div>` : ''}
    `;
    el.onclick = () => openTalhaoDetail(t.id);
    c.appendChild(el);
  });
}

// ============================================================
// ALERTS LIST
// ============================================================
export function renderAlerts(containerId: string, data: AlertItem[]): void {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  data.forEach(a => {
    c.innerHTML += `
      <div class="alert-item">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-desc">${a.desc}</div>
        </div>
        <div class="alert-time">${a.time ?? a.date ?? ''}</div>
        <div class="alert-status status-${a.status}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</div>
      </div>`;
  });
}

export function renderAlertsList(): void {
  renderAlerts('alerts-list', alertsData);
  renderAlerts('anomalias-list', anomalias.map(a => ({
    icon: a.status === 'aberto' ? '🔴' : a.status === 'andamento' ? '🟡' : '✅',
    title: a.title,
    desc: a.desc,
    date: a.date,
    status: a.status,
  })));
}

// ============================================================
// TALHÃO LIST
// ============================================================
export function renderTalhaoList(): void {
  const c = document.getElementById('talhao-list');
  if (!c) return;
  c.innerHTML = '';
  talhoes.forEach(t => {
    const dotClass = t.status === 'crit' ? 'dot-crit' : t.status === 'warn' ? 'dot-warn' : 'dot-ok';
    const umClass = t.umidade < 30 ? 'trend-down' : t.umidade > 70 ? 'trend-warn' : 'trend-up';
    const row = document.createElement('div');
    row.className = 'talhao-row';
    row.innerHTML = `
      <div class="t-status-dot ${dotClass}"></div>
      <div>
        <div class="t-info-name">Talhão ${t.id} · ${t.cultura}</div>
        <div class="t-info-sub">${t.area} ha · NDVI: ${t.ndvi} · ${t.alerts > 0 ? `⚠ ${t.alerts} alerta(s)` : '✓ Normal'}</div>
      </div>
      <div class="t-metrics">
        <div class="t-metric">
          <div class="t-metric-val ${umClass}">${t.umidade}%</div>
          <div class="t-metric-lbl">Umidade</div>
        </div>
        <div class="t-metric">
          <div class="t-metric-val">${t.energia} kWh</div>
          <div class="t-metric-lbl">Energia</div>
        </div>
        <div class="t-metric">
          <div class="t-metric-val" style="color:${getNdviColor(t.ndvi)}">${t.ndvi}</div>
          <div class="t-metric-lbl">NDVI</div>
        </div>
      </div>
      <button class="t-action-btn">Ver detalhes →</button>`;
    row.onclick = () => openTalhaoDetail(t.id);
    c.appendChild(row);
  });
}

// ============================================================
// GERENCIAL TALHÃO LIST
// ============================================================
export function renderGerencialTalhaoList(): void {
  const c = document.getElementById('ger-talhao-list');
  if (!c) return;
  c.innerHTML = '';
  talhoes.forEach(t => {
    const dotClass = t.status === 'crit' ? 'dot-crit' : t.status === 'warn' ? 'dot-warn' : 'dot-ok';
    const umClass = t.umidade < 30 ? 'trend-down' : t.umidade > 70 ? 'trend-warn' : 'trend-up';
    const row = document.createElement('div');
    row.className = 'talhao-row';
    row.innerHTML = `
      <div class="t-status-dot ${dotClass}"></div>
      <div>
        <div class="t-info-name">Talhão ${t.id} · ${t.cultura}</div>
        <div class="t-info-sub">${t.area} ha · NDVI: ${t.ndvi} · ${t.alerts > 0 ? `⚠ ${t.alerts} alerta(s)` : '✓ Normal'}</div>
      </div>
      <div class="t-metrics">
        <div class="t-metric">
          <div class="t-metric-val ${umClass}">${t.umidade}%</div>
          <div class="t-metric-lbl">Umidade</div>
        </div>
        <div class="t-metric">
          <div class="t-metric-val">${t.energia} kWh</div>
          <div class="t-metric-lbl">Energia</div>
        </div>
        <div class="t-metric">
          <div class="t-metric-val" style="color:${getNdviColor(t.ndvi)}">${t.ndvi}</div>
          <div class="t-metric-lbl">NDVI</div>
        </div>
      </div>
      <button class="t-action-btn">Ver detalhes →</button>`;
    row.onclick = () => openTalhaoDetail(t.id);
    c.appendChild(row);
  });
}

// ============================================================
// TALHÃO DETAIL
// ============================================================
export function openTalhaoDetail(talhaoId: string): void {
  const t = talhoes.find(x => x.id === talhaoId);
  if (!t) return;

  (document.getElementById('detail-title') as HTMLElement).textContent = `Talhão ${t.id} · ${t.cultura}`;

  const banner = document.getElementById('detail-status-banner') as HTMLElement;
  banner.className = 'detail-status-banner ' + (t.status === 'crit' ? 'banner-crit' : t.status === 'warn' ? 'banner-warn' : 'banner-ok');
  banner.textContent = t.status === 'crit' ? '⚠ Status Crítico' : t.status === 'warn' ? '⚠ Atenção Necessária' : '✓ Normal';

  (document.getElementById('detail-meta') as HTMLElement).innerHTML =
    `Área: <span>${t.area} ha</span> &nbsp;·&nbsp; Cultura: <span>${t.cultura}</span> &nbsp;·&nbsp; Última atualização: <span>23/03/2026 · 17:10</span>`;

  const umColor = t.umidade < 30 ? 'var(--accent-red)' : t.umidade > 70 ? 'var(--accent-blue)' : 'var(--green-400)';
  (document.getElementById('detail-kpis') as HTMLElement).innerHTML = `
    <div class="detail-kpi"><div class="detail-kpi-val" style="color:${umColor}">${t.umidade}%</div><div class="detail-kpi-lbl">Umidade</div></div>
    <div class="detail-kpi"><div class="detail-kpi-val" style="color:${getNdviColor(t.ndvi)}">${t.ndvi}</div><div class="detail-kpi-lbl">NDVI</div></div>
    <div class="detail-kpi"><div class="detail-kpi-val">${t.energia}</div><div class="detail-kpi-lbl">kWh</div></div>
    <div class="detail-kpi"><div class="detail-kpi-val">${t.alerts}</div><div class="detail-kpi-lbl">Alertas</div></div>`;

  const sug = actionSuggestions[t.status];
  (document.getElementById('detail-problem') as HTMLElement).textContent = sug.problem;
  (document.getElementById('detail-action') as HTMLElement).textContent  = sug.action;
  document.getElementById('reg-success')?.classList.remove('visible');
  const actionCard = document.getElementById('detail-action-card') as HTMLElement;
  actionCard.style.display = t.status === 'ok' ? 'none' : 'block';

  (document.getElementById('det-energia-badge') as HTMLElement).textContent = `${t.energia} kWh`;
  const umLabel = t.umidade < 30 ? '⚠ Seco – Abaixo do Limite' : t.umidade > 70 ? '⚠ Encharcamento' : '✓ Faixa Normal';
  (document.getElementById('det-umidade-badge') as HTMLElement).textContent = umLabel;

  // Camera
  (document.getElementById('det-cam-name') as HTMLElement).textContent = `Talhão ${t.id}`;
  (document.getElementById('det-cam-ndvi') as HTMLElement).textContent = `NDVI ${t.ndvi}`;
  const hasAnomaly = t.status !== 'ok';
  const statusBadge = document.getElementById('det-cam-status-badge') as HTMLElement;
  statusBadge.textContent = hasAnomaly ? '⚠ ANOMALIA' : '● AO VIVO';
  statusBadge.className = 'cam-badge ' + (hasAnomaly ? 'cam-anomaly' : 'cam-live');
  (document.getElementById('det-cam-anomaly') as HTMLElement).textContent = hasAnomaly
    ? 'Anomalia detectada · ' + (t.umidade < 30 ? 'Seca crítica' : 'Consumo elevado')
    : 'Sem anomalia detectada';
  const detCamBadge = document.getElementById('det-cam-badge') as HTMLElement;
  detCamBadge.className = 'chart-badge ' + (hasAnomaly ? 'badge-amber' : 'badge-green');
  detCamBadge.textContent = hasAnomaly ? '⚠ Anomalia' : '✓ Normal';
  (document.getElementById('det-cam-sub') as HTMLElement).textContent = `Talhão ${t.id} · Câmera de monitoramento`;

  setTimeout(() => {
    const camCanvas = document.getElementById('det-cam-canvas') as HTMLCanvasElement | null;
    if (camCanvas) drawPlant(camCanvas, t.ndvi, hasAnomaly, t.umidade < 30 ? 'Seca Crítica' : 'Praga Detectada');
  }, 80);

  // Intervention history
  const hist = interventionHistory[t.id] ?? interventionHistory['default']!;
  (document.getElementById('det-interventions') as HTMLElement).innerHTML = hist.map(h => `
    <div class="interv-item">
      <div class="interv-date">${h.date}</div>
      <div class="interv-body">
        <div class="interv-title">${h.title}</div>
        <div class="interv-desc">${h.desc}</div>
      </div>
    </div>`).join('');

  renderDetailCharts(talhaoId);
  goToSection('op-talhao-detail', null);
  window.scrollTo(0, 0);
}

export function registerIntervention(): void {
  const succ = document.getElementById('reg-success');
  succ?.classList.add('visible');
  setTimeout(() => succ?.classList.remove('visible'), 4000);
}

// ============================================================
// GAUGES
// ============================================================
export function renderGauges(): void {
  const c = document.getElementById('gauge-grid');
  if (!c) return;
  c.innerHTML = '';
  talhoes.slice(0, 8).forEach(t => {
    const pct = t.umidade;
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    const color = pct < 30 ? '#e84545' : pct > 70 ? '#4a9eff' : '#52c278';
    const statusTxt = pct < 30 ? '⚠ Seco' : pct > 70 ? '⚠ Encharcado' : '✓ Normal';
    const statusColor = pct < 30 ? 'var(--accent-red)' : pct > 70 ? 'var(--accent-blue)' : 'var(--green-400)';
    c.innerHTML += `
      <div class="gauge-card">
        <div class="gauge-name">Talhão ${t.id}</div>
        <div class="gauge-ring">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle class="gauge-track" cx="40" cy="40" r="${r}"/>
            <circle class="gauge-fill" cx="40" cy="40" r="${r}"
              stroke="${color}"
              stroke-dasharray="${circ}"
              stroke-dashoffset="${offset}"
            />
          </svg>
          <div class="gauge-center">${pct}%</div>
        </div>
        <div class="gauge-status" style="color:${statusColor}">${statusTxt}</div>
      </div>`;
  });
}

// ============================================================
// SETOR BARS
// ============================================================
export function renderSetorBars(): void {
  const c = document.getElementById('setor-bars');
  if (!c) return;
  
  // Mockar consumo por setor em Wh, somando ao total da semana
  const setores: Array<{ name: string; pct: number; wh?: number }> = [
    { name: 'Setor A', pct: 25 },
    { name: 'Setor B', pct: 22 },
    { name: 'Setor C', pct: 20 },
    { name: 'Setor D', pct: 18 },
    { name: 'Setor E', pct: 15 },
  ];
  
  // Usar consumo total real da API
  const totalWh = getWeeklyTotalEnergyWh();
  
  // Calcular Wh por setor baseado em percentual
  setores.forEach(s => {
    s.wh = (totalWh * s.pct) / 100;
  });
  
  c.innerHTML = setores.map(s => `
    <div class="setor-bar-row">
      <div class="setor-lbl">${s.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${s.pct * 3.5}%"></div></div>
      <div class="setor-val">${(s.wh || 0).toFixed(2)} Wh</div>
    </div>`).join('');
}

// ============================================================
// PLANT CAMERA SIMULATION
// ============================================================
const cameraData = [
  { name: 'Talhão A1', ndvi: 0.45, status: 'anomaly', anomaly: 'Seca Crítica',    umidade: 22, temp: 31, hora: '08:30' },
  { name: 'Talhão B2', ndvi: 0.78, status: 'live',    anomaly: null,               umidade: 61, temp: 26, hora: '08:32' },
  { name: 'Talhão C3', ndvi: 0.58, status: 'anomaly', anomaly: 'Praga Detectada',  umidade: 68, temp: 27, hora: '08:29' },
  { name: 'Talhão D4', ndvi: 0.71, status: 'live',    anomaly: null,               umidade: 53, temp: 29, hora: '08:31' },
  { name: 'Talhão E5', ndvi: 0.79, status: 'live',    anomaly: null,               umidade: 57, temp: 27, hora: '08:33' },
];

export function renderCameras(): void {
  const c = document.getElementById('camera-grid');
  if (!c) return;
  c.innerHTML = '';
  cameraData.forEach(cam => {
    const hasAnomaly = cam.status === 'anomaly';
    const badgeClass = hasAnomaly ? 'cam-anomaly' : 'cam-live';
    const badgeTxt = hasAnomaly ? '⚠ ANOMALIA' : '● AO VIVO';
    const div = document.createElement('div');
    div.className = 'camera-card';
    const safeId = cam.name.replace(/\s/g, '');
    div.innerHTML = `
      <div class="camera-feed">
        <canvas class="plant-canvas" id="cam-${safeId}"></canvas>
        <div class="cam-overlay">
          <div class="cam-top">
            <span class="cam-badge ${badgeClass}">${badgeTxt}</span>
            <span class="cam-ndvi-badge">NDVI ${cam.ndvi}</span>
          </div>
          <div class="cam-bottom">
            <div class="cam-name">${cam.name}</div>
            <div class="cam-sub">${cam.anomaly ?? 'Sem anomalia detectada'} · ${cam.hora}</div>
          </div>
        </div>
      </div>
      <div class="camera-info">
        <div class="cam-stats">
          <div class="cam-stat"><strong>${cam.umidade}%</strong>Umidade</div>
          <div class="cam-stat"><strong>${cam.temp}°C</strong>Temp.</div>
        </div>
        <span class="chart-badge ${hasAnomaly ? 'badge-amber' : 'badge-green'}">${hasAnomaly ? '⚠ Alerta' : '✓ Normal'}</span>
      </div>`;
    c.appendChild(div);
    setTimeout(() => {
      const cvs = document.getElementById(`cam-${safeId}`) as HTMLCanvasElement | null;
      if (cvs) drawPlant(cvs, cam.ndvi, hasAnomaly, cam.anomaly);
    }, 50);
  });
}

export function drawPlant(cvs: HTMLCanvasElement, ndvi: number, hasAnomaly: boolean, anomalyType: string | null): void {
  const ctx = cvs.getContext('2d')!;
  const W = cvs.width = cvs.offsetWidth || 240;
  const H = cvs.height = 180;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  skyGrad.addColorStop(0, '#1a3c2a');
  skyGrad.addColorStop(1, '#0d2018');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  const gGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
  gGrad.addColorStop(0, '#2d5a1b');
  gGrad.addColorStop(1, '#1a3a0e');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  const baseColor = getNdviColor(ndvi);
  const numPlants = 8;
  for (let i = 0; i < numPlants; i++) {
    const x = (W / numPlants) * i + W / (numPlants * 2);
    const plantH = 40 + Math.sin(i * 1.7) * 15;
    const baseY = H * 0.6;

    ctx.strokeStyle = '#4a7a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(x - 5, baseY - plantH * 0.5, x + 5, baseY - plantH * 0.7, x, baseY - plantH);
    ctx.stroke();

    const lColor = hasAnomaly && anomalyType === 'Seca Crítica' ? '#8B6914'
                 : hasAnomaly ? '#6b8c2a'
                 : baseColor;
    ctx.fillStyle = lColor + 'cc';
    ([-1, 1] as const).forEach(dir => {
      ctx.beginPath();
      ctx.ellipse(x + dir * 18, baseY - plantH * 0.6, 18, 9, dir * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = lColor;
    ctx.beginPath();
    ctx.ellipse(x, baseY - plantH, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hasAnomaly && anomalyType === 'Praga Detectada' && i % 3 === 0) {
      ctx.fillStyle = '#8b2222aa';
      ctx.beginPath();
      ctx.arc(x + 5, baseY - plantH * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}
