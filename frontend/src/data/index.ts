// ============================================================
// TYPES
// ============================================================
export type TalhaoStatus = 'ok' | 'warn' | 'crit';

export interface Talhao {
  id: string;
  ndvi: number;
  umidade: number;
  status: TalhaoStatus;
  alerts: number;
  area: number;
  cultura: string;
  energia: number;
}

export interface AlertItem {
  icon: string;
  title: string;
  desc: string;
  time?: string;
  date?: string;
  status: string;
  sev?: string;
}

export interface Anomalia {
  title: string;
  desc: string;
  date: string;
  status: string;
}

export interface InterventionRecord {
  date: string;
  title: string;
  desc: string;
}

export interface ActionSuggestion {
  problem: string;
  action: string;
}

export interface SensorData {
  Timestamp: string;
  Channel: string;
  Sensor: string;
  "ApparentPower [VA]": number;
  "ActivePower [W]": number;
  "ReactivePower [VAr]": number;
  PowerFactor: number;
  "Voltage [V]": number;
  "Current [A]": number;
  Energy_kWh: number;
  Energy_kWh_cum: number;
  "Humidity A1 [%]": number;
  "Humidity B2 [%]": number;
  "Humidity C3 [%]": number;
  "Humidity D4 [%]": number;
  "Humidity E5 [%]": number;
}

// ============================================================
// DATA FETCHING
// ============================================================
const API_BASE_URL = 'http://localhost:8000/data';
const DEFAULT_START = '2025-12-01 19:00:00';
const DEFAULT_END = '2025-12-01 20:00:00';

export async function fetchSensorData(start?: string, end?: string): Promise<SensorData[]> {
  const params = new URLSearchParams({
    start: start || DEFAULT_START,
    end: end || DEFAULT_END,
    limit: '1500',
  });
  const url = `${API_BASE_URL}?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: SensorData[] = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch sensor data:', error);
    return [];
  }
}

export async function updateTalhoesFromAPI(start?: string, end?: string): Promise<void> {
  const data = await fetchSensorData(start, end);
  if (data.length === 0) {
    // No data returned, preserve existing talhões and keep the current dataset.
    console.warn('No sensor data available; keeping existing talhões.');
    return;
  }

  const sorted = sortSensorReadings(data);
  sensorData = sorted; // Store the ordered data

  // Assuming the latest data point
  const latest = sorted[sorted.length - 1];

  // Map humidity to talhoes
  const humidityMap: Record<string, number> = {
    A1: latest["Humidity A1 [%]"],
    B2: latest["Humidity B2 [%]"],
    C3: latest["Humidity C3 [%]"],
    D4: latest["Humidity D4 [%]"],
    E5: latest["Humidity E5 [%]"],
  };

  // Reset talhoes to only those with data
  talhoes.length = 0;
  Object.keys(humidityMap).forEach(id => {
    const umidade = humidityMap[id];
    const status = umidade < 30 ? 'crit' : umidade < 50 ? 'warn' : 'ok';
    talhoes.push({
      id,
      ndvi: 0.5, // default
      umidade,
      status,
      alerts: status === 'crit' ? 1 : 0,
      area: 100, // default
      cultura: 'Soja', // default
      energia: Math.round((latest.Energy_kWh_cum || 0) * 100) / 100,
    });
  });
}

// ============================================================
// TIME SERIES FUNCTIONS
// ============================================================
export function getHumidityTimeSeries(talhaoId: string): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const humidityKey = `Humidity ${talhaoId} [%]` as keyof SensorData;
  return buildAverageSeries(reading => reading[humidityKey] as number | undefined, {
    decimals: 2,
    includeSeconds: false,
  });
}

export function getAllHumidityTimeSeries(
  talhaoIds: string[] = ['A1', 'B2', 'C3', 'D4', 'E5']
): { labels: string[]; series: Record<string, number[]> } {
  if (sensorData.length === 0) {
    return { labels: [], series: Object.fromEntries(talhaoIds.map(id => [id, []])) };
  }

  const ordered = sortSensorReadings(sensorData);
  const labels = ordered.map(reading => {
    const ms = toTimestampMs(reading.Timestamp);
    return formatTimeLabel(ms, false);
  });

  const series: Record<string, number[]> = {};
  talhaoIds.forEach(id => {
    const humidityKey = `Humidity ${id} [%]` as keyof SensorData;
    series[id] = ordered.map(reading => {
      const val = reading[humidityKey];
      return typeof val === 'number' && !Number.isNaN(val) ? parseFloat(val.toFixed(2)) : NaN;
    });
  });

  return { labels, series };
}

export function getEnergyAccumulativeTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const aggregated = new Map<number, number>();
  sortSensorReadings(sensorData).forEach(reading => {
    const ms = toTimestampMs(reading.Timestamp);
    const value = reading.Energy_kWh_cum ?? 0;
    const current = aggregated.get(ms) ?? 0;
    aggregated.set(ms, Math.max(current, value));
  });

  const times = Array.from(aggregated.keys()).sort((a, b) => a - b);
  return {
    labels: times.map(ms => formatTimeLabel(ms)),
    data: times.map(ms => aggregated.get(ms) ?? 0),
  };
}

export function getEnergyKwhTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };
  return buildSumSeries(reading => reading.Energy_kWh ?? 0);
}

export function getWeeklyEnergyData(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const dailyTotals = new Map<string, { label: string; value: number; time: number }>();

  sortSensorReadings(sensorData).forEach(reading => {
    const date = new Date(reading.Timestamp);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayName = dayNames[date.getDay()];
    const label = `${dayName} ${dayKey}`;
    dailyTotals.set(dayKey, { label, value: reading.Energy_kWh_cum || 0, time: date.getTime() });
  });

  const lastSeven = Array.from(dailyTotals.values())
    .sort((a, b) => a.time - b.time)
    .slice(-7);

  return {
    labels: lastSeven.map(item => item.label),
    data: lastSeven.map(item => item.value),
  };
}

export function getWeeklyTotalEnergyWh(): number {
  if (sensorData.length === 0) return 7; // Default 7 Wh

  const accumSeries = getEnergyAccumulativeTimeSeries();
  if (accumSeries.data.length === 0) return 7;

  const maxEnergy = Math.max(...accumSeries.data);
  const whValue = maxEnergy * 1000; // Converter kWh para Wh
  
  // Retornar em Wh (arredondar para 1 casa decimal)
  return Math.round(whValue * 10) / 10 || 7;
}

export function getPowerFactorTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };
  return buildAverageSeries(reading => reading.PowerFactor, { decimals: 3 });
}

// ============================================================
// DATA STORAGE
// ============================================================
export let sensorData: SensorData[] = [];

function toTimestampMs(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function sortSensorReadings(readings: SensorData[]): SensorData[] {
  return [...readings].sort((a, b) => toTimestampMs(a.Timestamp) - toTimestampMs(b.Timestamp));
}

const TIME_WITH_SECONDS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
const TIME_NO_SECONDS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

function formatTimeLabel(ms: number, includeSeconds = true): string {
  return new Date(ms).toLocaleTimeString('pt-BR', includeSeconds ? TIME_WITH_SECONDS : TIME_NO_SECONDS);
}

interface AverageSeriesOptions {
  decimals?: number;
  includeSeconds?: boolean;
}

function buildAverageSeries(
  accessor: (reading: SensorData) => number | undefined,
  opts?: AverageSeriesOptions
): { labels: string[]; data: number[] } {
  const decimals = opts?.decimals ?? 2;
  const includeSeconds = opts?.includeSeconds ?? true;
  const aggregated = new Map<number, { sum: number; count: number }>();

  sortSensorReadings(sensorData).forEach(reading => {
    const value = accessor(reading);
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const ms = toTimestampMs(reading.Timestamp);
    const entry = aggregated.get(ms) ?? { sum: 0, count: 0 };
    entry.sum += value;
    entry.count += 1;
    aggregated.set(ms, entry);
  });

  const times = Array.from(aggregated.keys()).sort((a, b) => a - b);
  return {
    labels: times.map(ms => formatTimeLabel(ms, includeSeconds)),
    data: times.map(ms => {
      const entry = aggregated.get(ms)!;
      const avg = entry.sum / entry.count || 0;
      return parseFloat(avg.toFixed(decimals));
    }),
  };
}

function buildSumSeries(accessor: (reading: SensorData) => number | undefined): { labels: string[]; data: number[] } {
  const aggregated = new Map<number, number>();

  sortSensorReadings(sensorData).forEach(reading => {
    const value = accessor(reading);
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const ms = toTimestampMs(reading.Timestamp);
    aggregated.set(ms, (aggregated.get(ms) ?? 0) + value);
  });

  const times = Array.from(aggregated.keys()).sort((a, b) => a - b);
  return {
    labels: times.map(ms => formatTimeLabel(ms)),
    data: times.map(ms => parseFloat((aggregated.get(ms) ?? 0).toFixed(4))),
  };
}

// ============================================================
// STATIC DATA (fallback)
// ============================================================
export let talhoes: Talhao[] = [
  { id: 'A1', ndvi: 0.45, umidade: 22, status: 'crit', alerts: 1, area: 98,  cultura: 'Soja',  energia: 165 },
  { id: 'B2', ndvi: 0.78, umidade: 61, status: 'ok',   alerts: 0, area: 103, cultura: 'Cana',  energia: 120 },
  { id: 'C3', ndvi: 0.58, umidade: 68, status: 'warn', alerts: 1, area: 94,  cultura: 'Soja',  energia: 110 },
  { id: 'D4', ndvi: 0.71, umidade: 53, status: 'ok',   alerts: 0, area: 118, cultura: 'Cana',  energia: 132 },
  { id: 'E5', ndvi: 0.79, umidade: 57, status: 'ok',   alerts: 0, area: 95,  cultura: 'Soja',  energia: 127 },
];

export const alerts: AlertItem[] = [
  { icon: '💧', title: 'Talhão A1 – Umidade Crítica', desc: '22% · Limite: 35% · Irrigação pode estar inoperante', time: '08:30', status: 'aberto', sev: 'crit' },
  { icon: '⚡', title: 'Talhão C3 – Consumo Elevado',  desc: 'Consumo energético acima do limite configurado',    time: '07:15', status: 'andamento', sev: 'warn' },
  { icon: '📷', title: 'Talhão D4 – Anomalia Visual',  desc: 'Possível presença de praga detectada por câmera',  time: '06:45', status: 'andamento', sev: 'warn' },
];

export const anomalias: Anomalia[] = [
  { title: 'Talhão A1', desc: 'Umidade do solo',             date: '23/03/2026', status: 'aberto'    },
  { title: 'Talhão C3', desc: 'Consumo energético elevado',  date: '23/03/2026', status: 'andamento' },
  { title: 'Talhão D4', desc: 'Anomalia visual',             date: '23/03/2026', status: 'aberto'    },
  { title: 'Talhão B2', desc: 'Umidade do solo',             date: '21/03/2026', status: 'resolvido' },
  { title: 'Talhão E5', desc: 'Anomalia visual',             date: '20/03/2026', status: 'resolvido' },
  { title: 'Talhão A1', desc: 'Consumo energético',          date: '19/03/2026', status: 'resolvido' },
];

export const interventionHistory: Record<string, InterventionRecord[]> = {
  A1: [
    { date: '21/03', title: 'Irrigação emergencial',      desc: 'Acionamento do sistema de gotejamento por 4h' },
    { date: '15/03', title: 'Análise de solo',            desc: 'Coleta para análise laboratorial de nutrientes' },
    { date: '08/03', title: 'Aplicação de fertilizante',  desc: 'NPK 10-10-10 · 120 kg/ha' },
  ],
  B2: [
    { date: '22/03', title: 'Verificação de bomba',    desc: 'Pressão da bomba checada · Ajuste de 2.1 para 2.5 bar' },
    { date: '18/03', title: 'Manutenção preventiva',   desc: 'Limpeza de filtros e microaspersores' },
  ],
  C3: [
    { date: '20/03', title: 'Ajuste de carga elétrica', desc: 'Redistribuição de carga entre fases A e B' },
  ],
  D4: [
    { date: '19/03', title: 'Inspeção visual', desc: 'Verificação de pragas e doenças' },
  ],
  E5: [
    { date: '17/03', title: 'Aplicação de herbicida', desc: 'Controle de ervas daninhas' },
  ],
  default: [
    { date: '10/03', title: 'Visita técnica', desc: 'Inspeção de rotina · Sem anomalias detectadas' },
    { date: '01/03', title: 'Plantio',        desc: 'Semeadura realizada com êxito' },
  ],
};

export const actionSuggestions: Record<TalhaoStatus, ActionSuggestion> = {
  crit: {
    problem: 'Umidade do solo abaixo do limiar crítico. Sistema de irrigação pode estar inoperante ou com vazamento.',
    action:  'Inspeção urgente no setor. Verificar pressão da bomba, estado das tubulações e válvulas solenoides. Acionar irrigação manual se necessário.',
  },
  warn: {
    problem: 'Anomalia detectada na variável monitorada. Atenção recomendada antes que se torne crítico.',
    action:  'Agendar visita ao talhão nas próximas 24h. Verificar histórico e comparar com talhões adjacentes.',
  },
  ok: {
    problem: 'Nenhum problema identificado. Talhão operando dentro dos parâmetros normais.',
    action:  'Manter monitoramento contínuo. Próxima visita programada conforme calendário agrícola.',
  },
};

// Time / week labels used by charts
export const timeLabels: string[] = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
export const weekLabels: string[] = ['17/03', '18/03', '19/03', '20/03', '21/03', '22/03', '23/03'];
