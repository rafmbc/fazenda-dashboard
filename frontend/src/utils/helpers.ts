// ============================================================
// UTILITY HELPERS
// ============================================================

export function getNdviColor(ndvi: number): string {
  if (ndvi < 0.30) return '#c0392b';
  if (ndvi < 0.45) return '#e67e22';
  if (ndvi < 0.55) return '#f1c40f';
  if (ndvi < 0.65) return '#a8d05a';
  if (ndvi < 0.75) return '#3aad5f';
  return '#1e7a3e';
}

/** Returns n random values centred on `base` ± `variance`. */
export function rand(base: number, variance: number, n: number): number[] {
  return Array.from({ length: n }, () => base + (Math.random() - 0.5) * variance * 2);
}

/** Cumulative sum. */
export function cumsum(arr: number[]): number[] {
  let s = 0;
  return arr.map(v => (s += v));
}

export function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
