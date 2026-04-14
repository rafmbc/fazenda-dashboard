import { renderCameras } from './renderers.js';
import { initCharts } from '../charts/index.js';

// ============================================================
// SECTION NAVIGATION
// ============================================================
let currentSection = 'op-overview';
let currentView = 'operacional';
const LAYOUT_STORAGE_KEY = 'fazenda-layout-mode';

function applyLayoutMode(mode: 'desktop' | 'mobile'): void {
  const html = document.documentElement;
  html.setAttribute('data-layout', mode);

  const btn = document.getElementById('layout-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = '📱';
    btn.setAttribute('aria-pressed', mode === 'mobile' ? 'true' : 'false');
    btn.setAttribute('title', mode === 'mobile' ? 'Voltar para visão desktop' : 'Ativar visão para celular');
    btn.classList.toggle('active', mode === 'mobile');
  }
}

export function initLayoutPreference(): void {
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  const mode = stored === 'mobile' ? 'mobile' : 'desktop';
  applyLayoutMode(mode);
}

export function goToSection(id: string, clickedEl: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  currentSection = id;

  document.querySelectorAll<HTMLElement>('.nav-item').forEach(n => n.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  if (id === 'op-cameras') renderCameras();
  if (id === 'op-umidade') setTimeout(initCharts, 50);
}

export function goToSectionMob(id: string, clickedEl: HTMLElement | null): void {
  goToSection(id, null);
  document.querySelectorAll<HTMLElement>('.mob-nav-item').forEach(n => n.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');
}

export function highlightNav(sectionId: string): void {
  const map: Record<string, number> = { 'op-talhoes': 1 };
  document.querySelectorAll<HTMLElement>('.nav-item').forEach((n, i) => {
    n.classList.toggle('active', i === (map[sectionId] ?? 0));
  });
}

// ============================================================
// VIEW SWITCH (Operacional / Gerencial)
// ============================================================
export function switchView(view: string, btn: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentView = view;
  
  // Hide/show nav items based on view
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(el => {
    const elView = el.getAttribute('data-view');
    el.style.display = elView === view ? '' : 'none';
  });

  if (view === 'operacional') {
    const firstNav = document.querySelector<HTMLElement>('.nav-item[data-view="operacional"]');
    goToSection('op-overview', firstNav);
    firstNav?.classList.add('active');
  } else {
    const gerencialNav = document.querySelector<HTMLElement>('.nav-item[data-view="gerencial"]');
    goToSection('ger-overview', gerencialNav);
    gerencialNav?.classList.add('active');
  }
}

// ============================================================
// THEME & LAYOUT TOGGLES
// ============================================================
export function toggleTheme(): void {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const btn = document.getElementById('theme-btn') as HTMLElement;
  btn.textContent = isDark ? '🌙' : '☀️';
  setTimeout(initCharts, 50);
}

export function toggleLayout(): void {
  const html = document.documentElement;
  const current = html.getAttribute('data-layout') === 'mobile' ? 'mobile' : 'desktop';
  const next = current === 'mobile' ? 'desktop' : 'mobile';

  applyLayoutMode(next);
  localStorage.setItem(LAYOUT_STORAGE_KEY, next);
}
