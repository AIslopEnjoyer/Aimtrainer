// Persistenz der persönlichen Bestwerte pro Modus (localStorage).
const KEY = 'apexaim.best.v1';

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

export function getBest(mode) {
  const all = loadAll();
  return all[mode] || null; // { score, accuracy, date }
}

// Gibt true zurück, wenn ein neuer Bestwert (nach Score) gesetzt wurde.
export function submitScore(mode, result) {
  const all = loadAll();
  const prev = all[mode];
  if (!prev || result.score > prev.score) {
    all[mode] = { score: result.score, accuracy: result.accuracy, date: Date.now() };
    saveAll(all);
    return true;
  }
  return false;
}
