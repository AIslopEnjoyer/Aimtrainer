// Zentrale Einstellungen mit localStorage-Persistenz.
const KEY = 'apexaim.settings.v1';

export const defaults = {
  sensitivity: 1.0,   // Multiplikator
  fov: 100,           // vertikales FOV in Grad
  invertY: false,
  crosshair: {
    size: 10,
    gap: 4,
    thickness: 2,
    dot: true,
    color: '#00ff9c',
  },
  targetScale: 1.0,
  antialias: true,
  shadows: false,
  perfMode: false,
  fpsCap: false,
  volume: 0.5,
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

export const settings = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    return deepMerge(defaults, JSON.parse(raw));
  } catch (e) {
    return structuredClone(defaults);
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) { /* localStorage evtl. gesperrt */ }
}

export function resetSettings() {
  const fresh = structuredClone(defaults);
  Object.keys(settings).forEach((k) => delete settings[k]);
  Object.assign(settings, fresh);
  saveSettings();
}
