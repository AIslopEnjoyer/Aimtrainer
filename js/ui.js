import { settings, saveSettings, resetSettings, defaults } from './settings.js';
import { getBest } from './storage.js';
import { MODE_REGISTRY } from './modes.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      menu: $('menu'),
      settings: $('settings'),
      pause: $('pause'),
      results: $('results'),
      clickResume: $('click-resume'),
      crosshair: $('crosshair'),
      chDot: document.querySelector('.ch-dot'),
      chTop: document.querySelector('.ch-top'),
      chBottom: document.querySelector('.ch-bottom'),
      chLeft: document.querySelector('.ch-left'),
      chRight: document.querySelector('.ch-right'),
      hitmarker: $('hitmarker'),
      muzzle: $('muzzle'),
      damageFlash: $('damage-flash'),
      statTime: $('stat-time'),
      statScore: $('stat-score'),
      statAcc: $('stat-acc'),
      statReaction: $('stat-reaction'),
      statReactionWrap: $('stat-reaction-wrap'),
      statKills: $('stat-kills'),
      statKillsWrap: $('stat-kills-wrap'),
      fpsPanel: $('fps-panel'),
      fpsVal: $('fps-val'),
      healthPanel: $('health-panel'),
      hpFill: $('hp-fill'),
      weaponName: $('weapon-name'),
      ammo: $('ammo'),
      ammoMag: $('ammo-mag'),
      ammoReserve: $('ammo-reserve'),
      reloadHint: $('reload-hint'),
      menuWeapon: $('menu-weapon'),
      menuDuration: $('menu-duration'),
      resultsTitle: $('results-title'),
      resultsGrid: $('results-grid'),
      resultsBest: $('results-best'),
    };
    this.selectedMode = 'flick';
    this.callbacks = {};
    this._hitmarkerTimer = null;
    this._flashTimer = null;
    this._bindMenu();
    this._bindSettings();
    this.applyCrosshair();
    this.refreshBestLabels();
  }

  on(name, fn) { this.callbacks[name] = fn; }
  _emit(name, ...args) { if (this.callbacks[name]) this.callbacks[name](...args); }

  // ---------------- Screens ----------------
  showScreen(name) {
    for (const s of ['menu', 'settings', 'pause', 'results']) {
      this.el[s].classList.toggle('hidden', s !== name);
    }
    this.el.hud.classList.toggle('hidden', name !== null);
    this.el.clickResume.classList.add('hidden');
  }

  showClickResume(show) {
    this.el.clickResume.classList.toggle('hidden', !show);
  }

  // ---------------- Menü ----------------
  _bindMenu() {
    document.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;
      });
    });
    document.querySelector('.mode-card[data-mode="flick"]').classList.add('selected');

    $('btn-start').addEventListener('click', () => {
      this._emit('start', this.selectedMode, this.el.menuWeapon.value, parseInt(this.el.menuDuration.value, 10));
    });
    $('btn-settings').addEventListener('click', () => this.showScreen('settings'));
    $('btn-settings-back').addEventListener('click', () => this.showScreen('menu'));
    $('btn-settings-reset').addEventListener('click', () => {
      resetSettings();
      this._syncSettingsInputs();
      this.applyCrosshair();
      this._emit('settingsChanged');
    });

    $('btn-resume').addEventListener('click', () => this._emit('resume'));
    $('btn-restart').addEventListener('click', () => this._emit('restart'));
    $('btn-quit').addEventListener('click', () => this._emit('quit'));
    $('btn-again').addEventListener('click', () => this._emit('restart'));
    $('btn-menu').addEventListener('click', () => this._emit('quit'));
  }

  refreshBestLabels() {
    document.querySelectorAll('[data-best]').forEach((el) => {
      const b = getBest(el.dataset.best);
      el.textContent = b ? `Best: ${b.score} · ${b.accuracy.toFixed(0)}%` : 'Best: —';
    });
  }

  // ---------------- Settings-Binding ----------------
  _bindSettings() {
    const bindRange = (id, valId, apply, fmt = (v) => v) => {
      const input = $(id), label = $(valId);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        apply(v);
        if (label) label.textContent = fmt(v);
        saveSettings();
        this._emit('settingsChanged');
      });
    };
    const bindCheck = (id, apply) => {
      const input = $(id);
      input.addEventListener('change', () => {
        apply(input.checked);
        saveSettings();
        this._emit('settingsChanged');
      });
    };

    bindRange('s-sens', 'v-sens', (v) => (settings.sensitivity = v), (v) => v.toFixed(2));
    bindRange('s-fov', 'v-fov', (v) => (settings.fov = v), (v) => v.toFixed(0));
    bindCheck('s-invert', (v) => (settings.invertY = v));

    bindRange('s-ch-size', 'v-ch-size', (v) => { settings.crosshair.size = v; this.applyCrosshair(); });
    bindRange('s-ch-gap', 'v-ch-gap', (v) => { settings.crosshair.gap = v; this.applyCrosshair(); });
    bindRange('s-ch-thick', 'v-ch-thick', (v) => { settings.crosshair.thickness = v; this.applyCrosshair(); });
    bindCheck('s-ch-dot', (v) => { settings.crosshair.dot = v; this.applyCrosshair(); });
    $('s-ch-color').addEventListener('input', () => {
      settings.crosshair.color = $('s-ch-color').value;
      this.applyCrosshair();
      saveSettings();
    });

    bindRange('s-target', 'v-target', (v) => (settings.targetScale = v), (v) => v.toFixed(2));

    bindCheck('s-aa', (v) => (settings.antialias = v));
    bindCheck('s-shadows', (v) => (settings.shadows = v));
    bindCheck('s-perf', (v) => (settings.perfMode = v));
    bindCheck('s-fpscap', (v) => (settings.fpsCap = v));

    bindRange('s-vol', 'v-vol', (v) => (settings.volume = v / 100), (v) => v.toFixed(0));

    this._syncSettingsInputs();
  }

  _syncSettingsInputs() {
    $('s-sens').value = settings.sensitivity; $('v-sens').textContent = settings.sensitivity.toFixed(2);
    $('s-fov').value = settings.fov; $('v-fov').textContent = settings.fov.toFixed(0);
    $('s-invert').checked = settings.invertY;
    $('s-ch-size').value = settings.crosshair.size; $('v-ch-size').textContent = settings.crosshair.size;
    $('s-ch-gap').value = settings.crosshair.gap; $('v-ch-gap').textContent = settings.crosshair.gap;
    $('s-ch-thick').value = settings.crosshair.thickness; $('v-ch-thick').textContent = settings.crosshair.thickness;
    $('s-ch-dot').checked = settings.crosshair.dot;
    $('s-ch-color').value = settings.crosshair.color;
    $('s-target').value = settings.targetScale; $('v-target').textContent = settings.targetScale.toFixed(2);
    $('s-aa').checked = settings.antialias;
    $('s-shadows').checked = settings.shadows;
    $('s-perf').checked = settings.perfMode;
    $('s-fpscap').checked = settings.fpsCap;
    $('s-vol').value = settings.volume * 100; $('v-vol').textContent = (settings.volume * 100).toFixed(0);
  }

  applyCrosshair() {
    const c = settings.crosshair;
    this.el.crosshair.style.setProperty('--ch-color', c.color);
    const t = c.thickness, s = c.size, g = c.gap;
    const set = (el, w, h, left, top) => {
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    };
    set(this.el.chTop, t, s, -t / 2, -(g + s));
    set(this.el.chBottom, t, s, -t / 2, g);
    set(this.el.chLeft, s, t, -(g + s), -t / 2);
    set(this.el.chRight, s, t, g, -t / 2);
    this.el.chDot.style.display = c.dot ? 'block' : 'none';
    if (c.dot) set(this.el.chDot, Math.max(2, t), Math.max(2, t), -Math.max(2, t) / 2, -Math.max(2, t) / 2);
  }

  // ---------------- HUD ----------------
  configureHud(mode) {
    this.el.statReactionWrap.classList.toggle('hidden', !mode.showReaction);
    this.el.statKillsWrap.classList.toggle('hidden', !mode.showKills);
    this.el.healthPanel.classList.toggle('hidden', !mode.showHealth);
  }

  updateHud(state) {
    this.el.statTime.textContent = state.time.toFixed(1);
    this.el.statScore.textContent = state.score;
    this.el.statAcc.textContent = state.accuracy.toFixed(0) + '%';
    if (state.avgReaction != null) {
      this.el.statReaction.textContent = Math.round(state.avgReaction) + 'ms';
    } else {
      this.el.statReaction.textContent = '—';
    }
    this.el.statKills.textContent = state.kills;
  }

  updateWeapon(w) {
    this.el.weaponName.textContent = w.def.name;
    this.el.ammoMag.textContent = w.reloading ? '--' : w.mag;
    this.el.ammoReserve.textContent = '∞';
    this.el.ammo.classList.toggle('empty', w.mag <= 0 && !w.reloading);
    this.el.reloadHint.classList.toggle('hidden', !(w.mag <= 0 && !w.reloading));
  }

  updateHealth(hp, maxHp) {
    const pct = Math.max(0, hp / maxHp) * 100;
    this.el.hpFill.style.width = pct + '%';
    this.el.hpFill.classList.toggle('low', pct <= 30);
  }

  updateFps(fps) {
    this.el.fpsVal.textContent = Math.round(fps);
    this.el.fpsPanel.classList.toggle('warn', fps < 55 && fps >= 40);
    this.el.fpsPanel.classList.toggle('bad', fps < 40);
  }

  hitmarker(kill) {
    const h = this.el.hitmarker;
    h.classList.toggle('kill', kill);
    h.classList.add('show');
    clearTimeout(this._hitmarkerTimer);
    this._hitmarkerTimer = setTimeout(() => h.classList.remove('show'), kill ? 140 : 90);
  }

  muzzleFlash() {
    const m = this.el.muzzle;
    m.classList.remove('flash');
    // Reflow erzwingen, damit die Klasse bei schnellem Feuern neu triggert.
    void m.offsetWidth;
    m.classList.add('flash');
    clearTimeout(this._muzzleTimer);
    this._muzzleTimer = setTimeout(() => m.classList.remove('flash'), 50);
  }

  damageFlash() {
    const d = this.el.damageFlash;
    d.classList.add('hit');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => d.classList.remove('hit'), 120);
  }

  // ---------------- Ergebnisse ----------------
  showResults(modeKey, stats, isNewBest) {
    this.el.resultsTitle.textContent = MODE_REGISTRY[modeKey].title + ' — Ergebnis';
    const cells = [];
    const cell = (label, val) => cells.push(
      `<div class="result-cell"><div class="rc-label">${label}</div><div class="rc-val">${val}</div></div>`
    );
    cell('Score', stats.score);
    cell('Accuracy', stats.accuracy().toFixed(1) + '%');
    cell('Treffer', `${stats.hits}/${stats.shots}`);
    cell('Headshots', stats.headshots);
    if (modeKey === 'flick') {
      const avg = stats.avgReaction();
      cell('Ø Reaktion', avg != null ? Math.round(avg) + 'ms' : '—');
      cell('Beste Reaktion', stats.bestReaction < Infinity ? Math.round(stats.bestReaction) + 'ms' : '—');
    } else if (modeKey === 'duel') {
      cell('Kills', stats.kills);
      cell('Tode', stats.deaths);
    } else if (modeKey === 'tracking') {
      cell('Schaden', Math.round(stats.damage));
      cell('Kills', stats.kills);
    } else {
      cell('Kills', stats.hits);
      cell('Ziele/Sek', (stats.hits / Math.max(1, this._roundSeconds || 60)).toFixed(2));
    }
    this.el.resultsGrid.innerHTML = cells.join('');
    this.el.resultsBest.textContent = isNewBest ? '★ NEUER BESTWERT! ★' : '';
    this.el.resultsBest.classList.toggle('new-best', isNewBest);
    this.showScreen('results');
    this.refreshBestLabels();
  }
}
