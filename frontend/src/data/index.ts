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
export async function fetchSensorData(start?: string, end?: string): Promise<SensorData[]> {
  const defaultStart = '2025-12-01%2019:00:00';
  const defaultEnd = '2025-12-01%2020:00:00';
  const url = `http://localhost:8000/data?start=${start || defaultStart}&end=${end || defaultEnd}`;
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

  sensorData = data; // Store the full data

  // Assuming the latest data point
  const latest = data[data.length - 1];

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
      energia: latest["ActivePower [W]"] || 100,
    });
  });
}

// ============================================================
// TIME SERIES FUNCTIONS
// ============================================================
export function getHumidityTimeSeries(talhaoId: string): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const labels: string[] = [];
  const data: number[] = [];

  const humidityKey = `Humidity ${talhaoId} [%]` as keyof SensorData;

  sensorData.forEach(d => {
    const timestamp = new Date(d.Timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    labels.push(timestamp);
    data.push(d[humidityKey] as number);
  });

  return { labels, data };
}

export function getEnergyTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const labels: string[] = [];
  const data: number[] = [];

  sensorData.forEach(d => {
    const timestamp = new Date(d.Timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    labels.push(timestamp);
    data.push(d["ActivePower [W]"]);
  });

  return { labels, data };
}

export function getEnergyAccumulativeTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const labels: string[] = [];
  const data: number[] = [];

  sensorData.forEach(d => {
    const timestamp = new Date(d.Timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    labels.push(timestamp);
    data.push(d.Energy_kWh_cum);
  });

  return { labels, data };
}

export function getWeeklyEnergyData(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  // Agregação por dia da semana (pega último valor do dia = consumo total)
  const dailyTotals: Record<string, number> = {};
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  
  sensorData.forEach(d => {
    const date = new Date(d.Timestamp);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayName = dayNames[date.getDay()];
    const key = `${dayName} ${dayKey}`; // Seg 2026-04-12
    
    // Sempre sobrescreve com o mais recente (último valor do dia = consumo acumulado)
    dailyTotals[key] = d.Energy_kWh_cum || 0;
  });

  const labels = Object.keys(dailyTotals).slice(-7); // Últimos 7 dias
  const data = labels.map(k => dailyTotals[k]);

  return { labels, data };
}

export function getWeeklyTotalEnergyWh(): number {
  if (sensorData.length === 0) return 7; // Default 7 Wh
  
  const energies = sensorData.map(d => d.Energy_kWh_cum);
  const maxEnergy = Math.max(...energies);
  const whValue = maxEnergy * 1000; // Converter kWh para Wh
  
  // Retornar em Wh (arredondar para 1 casa decimal)
  return Math.round(whValue * 10) / 10 || 7;
}

export function getPowerFactorTimeSeries(): { labels: string[]; data: number[] } {
  if (sensorData.length === 0) return { labels: [], data: [] };

  const labels: string[] = [];
  const data: number[] = [];

  sensorData.forEach(d => {
    const timestamp = new Date(d.Timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    labels.push(timestamp);
    data.push(d.PowerFactor);
  });

  return { labels, data };
}

// ============================================================
// DATA STORAGE
// ============================================================
export let sensorData: SensorData[] = [];

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
