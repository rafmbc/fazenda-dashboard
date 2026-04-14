import { renderTalhaoMap, renderAlertsList, renderTalhaoList, renderGerencialTalhaoList, renderGauges, renderSetorBars, registerIntervention, openTalhaoDetail } from './components/renderers.js';
import { goToSection, goToSectionMob, switchView, toggleTheme, toggleLayout, highlightNav, initLayoutPreference } from './components/navigation.js';
import { initCharts, switchEnergyTab } from './charts/index.js';
import { openUploadModal, closeUploadModal, switchUploadTab, handleFile, applyData } from './utils/upload.js';
import { updateTalhoesFromAPI } from './data/index.js';

let fetchSequence = 0;
let autoFetchTimer: number | undefined;

function toApiDateTime(value: string): string {
  if (!value) return '';
  const normalized = value.length === 16 ? `${value}:00` : value;
  return normalized.replace('T', ' ');
}

// ============================================================
// FETCH DATA FUNCTION
// ============================================================
async function fetchData(): Promise<void> {
  const startInput = document.getElementById('start-date') as HTMLInputElement;
  const endInput = document.getElementById('end-date') as HTMLInputElement;
  if (!startInput || !endInput) return;

  const start = toApiDateTime(startInput.value);
  const end = toApiDateTime(endInput.value);
  if (!start || !end) return;

  if (new Date(start).getTime() > new Date(end).getTime()) {
    console.warn('Invalid date range: start is after end.');
    return;
  }

  const btn = document.querySelector('.date-picker button') as HTMLButtonElement;
  const loader = document.getElementById('fullscreen-loader');
  const currentFetch = ++fetchSequence;
  if (btn) btn.disabled = true;
  loader?.classList.remove('hidden');

  try {
    await updateTalhoesFromAPI(start, end);
    if (currentFetch !== fetchSequence) return;

    // Re-render components
    renderTalhaoMap('talhao-map');
    renderTalhaoMap('talhao-map-saude');
    renderAlertsList();
    renderTalhaoList();
    renderGerencialTalhaoList();
    renderGauges();
    renderSetorBars();
    setTimeout(initCharts, 100);
  } finally {
    if (btn) btn.disabled = false;
    loader?.classList.add('hidden');
  }
}

// ============================================================
// EXPOSE to inline onclick handlers in HTML
// The HTML still uses onclick="..." — expose to window so it works.
// ============================================================
declare global {
  interface Window {
    goToSection: typeof goToSection;
    goToSectionMob: typeof goToSectionMob;
    switchView: typeof switchView;
    switchEnergyTab: typeof switchEnergyTab;
    toggleTheme: typeof toggleTheme;
    toggleLayout: typeof toggleLayout;
    initLayoutPreference: typeof initLayoutPreference;
    highlightNav: typeof highlightNav;
    openUploadModal: typeof openUploadModal;
    closeUploadModal: typeof closeUploadModal;
    switchUploadTab: typeof switchUploadTab;
    handleFile: typeof handleFile;
    applyData: typeof applyData;
    registerIntervention: typeof registerIntervention;
    openTalhaoDetail: typeof openTalhaoDetail;
    fetchData: typeof fetchData;
  }
}

window.goToSection = goToSection;
window.goToSectionMob = goToSectionMob;
window.switchView = switchView;
window.switchEnergyTab = switchEnergyTab;
window.toggleTheme = toggleTheme;
window.toggleLayout = toggleLayout;
window.initLayoutPreference = initLayoutPreference;
window.highlightNav = highlightNav;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.switchUploadTab = switchUploadTab;
window.handleFile = handleFile;
window.applyData = applyData;
window.registerIntervention = registerIntervention;
window.openTalhaoDetail = openTalhaoDetail;
window.fetchData = fetchData;

window.addEventListener('DOMContentLoaded', () => {
  initLayoutPreference();
  const activeBtn = document.querySelector<HTMLElement>('.view-btn.active');
  if (activeBtn) switchView('operacional', activeBtn);

  const startInput = document.getElementById('start-date') as HTMLInputElement | null;
  const endInput = document.getElementById('end-date') as HTMLInputElement | null;
  const fetchBtn = document.getElementById('fetch-data-btn') as HTMLButtonElement | null;

  const triggerFetch = () => { void fetchData(); };
  const triggerFetchDebounced = () => {
    if (autoFetchTimer) window.clearTimeout(autoFetchTimer);
    autoFetchTimer = window.setTimeout(() => {
      void fetchData();
    }, 350);
  };

  startInput?.addEventListener('change', triggerFetch);
  endInput?.addEventListener('change', triggerFetch);
  startInput?.addEventListener('input', triggerFetchDebounced);
  endInput?.addEventListener('input', triggerFetchDebounced);

  startInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') triggerFetch();
  });
  endInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') triggerFetch();
  });

  // Reinforce click handling beyond inline onclick.
  fetchBtn?.addEventListener('click', triggerFetch);

  void fetchData();
});
