import { renderTalhaoMap, renderAlertsList, renderTalhaoList, renderGauges, renderSetorBars, registerIntervention, openTalhaoDetail } from './components/renderers.js';
import { goToSection, goToSectionMob, switchView, toggleTheme, toggleLayout, highlightNav, initLayoutPreference } from './components/navigation.js';
import { initCharts, switchEnergyTab } from './charts/index.js';
import { openUploadModal, closeUploadModal, switchUploadTab, handleFile, applyData } from './utils/upload.js';
import { updateTalhoesFromAPI } from './data/index.js';

// ============================================================
// FETCH DATA FUNCTION
// ============================================================
async function fetchData(): Promise<void> {
  const startInput = document.getElementById('start-date') as HTMLInputElement;
  const endInput = document.getElementById('end-date') as HTMLInputElement;
  if (!startInput || !endInput) return;

  const btn = document.querySelector('.date-picker button') as HTMLButtonElement;
  const loader = document.getElementById('fullscreen-loader');
  if (btn) btn.disabled = true;
  loader?.classList.remove('hidden');

  try {
    const start = startInput.value.replace('T', '%20');
    const end = endInput.value.replace('T', '%20');

    await updateTalhoesFromAPI(start, end);

    // Re-render components
    renderTalhaoMap('talhao-map');
    renderTalhaoMap('talhao-map-saude');
    renderAlertsList();
    renderTalhaoList();
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
  void fetchData();
});
