import * as THREE from 'three';
import { createWorld, applyRendererQuality } from './scene.js';
import { Player } from './player.js';
import { TargetManager, Bot } from './targets.js';
import { Weapon } from './weapons.js';
import { Stats, MODE_REGISTRY } from './modes.js';
import { UI } from './ui.js';
import { settings } from './settings.js';
import { submitScore } from './storage.js';
import * as audio from './audio.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.ui = new UI();
    this.keys = new Set();
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'results'
    this.firing = false;
    this.semiRequested = false;
    this.lastAntialias = settings.antialias;

    // Cursor-Ziel-Fallback, falls Pointer-Lock nicht verfügbar ist (z.B. eingebettet).
    this.cursorAim = false;
    this.mouseNDC = { x: 0, y: 0 };
    this._lockCheck = null;

    this.weapon = new Weapon('r99');
    this.stats = new Stats();
    this.mode = null;
    this.modeKey = 'flick';
    this.roundDuration = 60;
    this.timeLeft = 60;

    // FPS/Loop
    this.lastTime = performance.now();
    this.fpsSmooth = 60;
    this.fpsAccum = 0;
    this.capAccum = 0;
    this._hudAccum = 0;
    this._emptyClickCd = 0;

    this.buildWorld();
    this.bindInput();
    this.bindUI();

    this.ui.showScreen('menu');
    requestAnimationFrame((t) => this.loop(t));
  }

  // (Neu)aufbau der 3D-Welt – auch nötig, wenn AA umgeschaltet wird (nur im Menü).
  buildWorld() {
    if (this.world) {
      this.world.renderer.dispose();
    }
    this.world = createWorld(this.canvas);
    this.renderer = this.world.renderer;
    this.scene = this.world.scene;
    this.camera = this.world.camera;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();

    this.targets = new TargetManager(this.scene);
    this.bot = new Bot(this.scene);
    this.bot.hide();
    this.player = new Player(this.camera);
    this.player.apply();
    this.lastAntialias = settings.antialias;
  }

  bindUI() {
    this.ui.on('start', (mode, weapon, duration) => this.startRound(mode, weapon, duration));
    this.ui.on('resume', () => this.resume());
    this.ui.on('restart', () => this.startRound(this.modeKey, this.weapon.id, this.roundDuration));
    this.ui.on('quit', () => this.toMenu());
    this.ui.on('settingsChanged', () => this.applyLiveSettings());
  }

  applyLiveSettings() {
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    applyRendererQuality(this.renderer);
    this.renderer.shadowMap.enabled = settings.shadows && !settings.perfMode;
    audio.setVolume(settings.volume);
    // AA nur im Menü neu aufbauen (Konstruktor-Option).
    if (settings.antialias !== this.lastAntialias && this.state === 'menu') {
      this.buildWorld();
    }
  }

  // ---------------- Input ----------------
  bindInput() {
    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing') return;
      if (this.isLocked()) {
        this.player.onMouse(e.movementX || 0, e.movementY || 0);
      } else if (this.cursorAim) {
        const r = this.canvas.getBoundingClientRect();
        this.mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.mouseNDC.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
        this.ui.setCrosshairPos(e.clientX, e.clientY);
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (!this.isLocked() && !this.cursorAim) return;
      if (e.button === 0) {
        this.firing = true;
        this.semiRequested = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.firing = false;
        this.semiRequested = false;
        this.weapon.resetBurst();
      }
    });
    window.addEventListener('contextmenu', (e) => { if (this.state === 'playing') e.preventDefault(); });

    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (this.state === 'playing') {
        if (e.code === 'KeyR') this.startReload();
        // Im Cursor-Modus gibt es keinen Lock, der bei Esc verlassen wird -> selbst pausieren.
        if (e.code === 'Escape' && this.cursorAim && !this.isLocked()) this.pauseGame();
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('pointerlockchange', () => this.onLockChange());
  }

  isLocked() {
    return document.pointerLockElement === this.canvas;
  }

  requestLock() {
    audio.resumeAudio();
    let p = null;
    try { p = this.canvas.requestPointerLock?.(); } catch (e) { /* z.B. iframe */ }
    if (p && p.catch) p.catch(() => {});
    // Falls Pointer-Lock nicht greift (eingebettet/blockiert): Cursor-Ziel-Fallback.
    clearTimeout(this._lockCheck);
    this._lockCheck = setTimeout(() => {
      if ((this.state === 'playing' || this.state === 'paused') && !this.isLocked()) {
        this.enableCursorAim();
      }
    }, 400);
  }

  enableCursorAim() {
    this.cursorAim = true;
    document.getElementById('game-root').classList.add('cursor-aim');
    this.ui.setCursorHint(true);
    if (this.state === 'paused') {
      // im Pausemenü bleiben; wird per "Weiter" fortgesetzt
      return;
    }
    this.state = 'playing';
    this.ui.showScreen(null);
    this.lastTime = performance.now();
  }

  resume() {
    if (this.cursorAim) {
      this.state = 'playing';
      this.ui.showScreen(null);
      document.getElementById('game-root').classList.add('cursor-aim');
      this.lastTime = performance.now();
    } else {
      this.requestLock();
    }
  }

  pauseGame() {
    this.state = 'paused';
    this.firing = false;
    this.ui.showScreen('pause');
    document.getElementById('game-root').classList.remove('cursor-aim');
  }

  onLockChange() {
    if (this.isLocked()) {
      this.cursorAim = false;
      clearTimeout(this._lockCheck);
      document.getElementById('game-root').classList.remove('cursor-aim');
      this.ui.setCursorHint(false);
      this.ui.resetCrosshairPos();
      if (this.state === 'paused') {
        this.state = 'playing';
        this.ui.showScreen(null);
        this.lastTime = performance.now();
      }
    } else {
      // Lock verloren -> pausieren (außer im Cursor-Modus, Menü oder Ergebnis).
      if (this.state === 'playing' && !this.cursorAim) {
        this.pauseGame();
      }
    }
  }

  // ---------------- Rundensteuerung ----------------
  startRound(modeKey, weaponId, duration) {
    this.modeKey = modeKey;
    this.roundDuration = duration;
    this.timeLeft = duration;
    this.ui._roundSeconds = duration;

    this.weapon.set(weaponId);
    this.stats = new Stats();

    const ctx = {
      targets: this.targets,
      bot: this.bot,
      stats: this.stats,
      player: this.player,
      onPlayerHit: (dmg, dead) => {
        this.ui.damageFlash();
        audio.playHurt();
      },
    };
    this.player.reset();
    // Aufräumen von vorheriger Runde (Bot nur im Duell sichtbar).
    this.targets.clear();
    this.bot.hide();
    this.mode = new MODE_REGISTRY[modeKey].cls(ctx);
    this.mode.start();

    this.ui.configureHud(this.mode);
    this.ui.updateWeapon(this.weapon);
    this.ui.updateHealth(this.player.hp, this.player.maxHp);

    this.state = 'playing';
    this.ui.showScreen(null);
    this.lastTime = performance.now();
    this.requestLock();
  }

  endRound() {
    this.state = 'results';
    this.firing = false;
    clearTimeout(this._lockCheck);
    document.getElementById('game-root').classList.remove('cursor-aim');
    if (this.isLocked()) document.exitPointerLock();
    if (this.mode) this.mode.stop();
    const isBest = submitScore(this.modeKey, {
      score: this.stats.score,
      accuracy: this.stats.accuracy(),
    });
    this.ui.showResults(this.modeKey, this.stats, isBest);
  }

  toMenu() {
    this.state = 'menu';
    this.firing = false;
    clearTimeout(this._lockCheck);
    document.getElementById('game-root').classList.remove('cursor-aim');
    if (this.isLocked()) document.exitPointerLock();
    if (this.mode) { this.mode.stop(); this.mode = null; }
    this.targets.clear();
    this.bot.hide();
    this.ui.showScreen('menu');
  }

  startReload() {
    if (this.weapon.startReload()) {
      audio.playReload();
      this.ui.updateWeapon(this.weapon);
    }
  }

  // ---------------- Feuern ----------------
  handleFiring() {
    const w = this.weapon;
    const wantFire = w.def.auto ? this.firing : this.semiRequested;
    if (!wantFire) return;

    if (w.def.auto) {
      // Auto: mehrere Schüsse pro Frame möglich (Cooldown steuert Rate).
      let guard = 8;
      while (w.canFire() && guard-- > 0) this.fireOnce();
    } else {
      if (w.canFire()) { this.fireOnce(); this.semiRequested = false; }
    }

    // Leeres Magazin: trockenes Klicken + Auto-Reload.
    if (w.isEmpty() && !w.reloading) {
      if (this._emptyClickCd <= 0) { audio.playEmpty(); this._emptyClickCd = 0.25; }
      this.startReload();
    }
  }

  fireOnce() {
    const w = this.weapon;
    const kick = w.fire();
    this.stats.shots++;
    // Im Cursor-Modus kickt der Recoil nicht die Kamera (Zielen läuft über den Mauszeiger).
    if (!this.cursorAim) this.player.addRecoil(kick.up, kick.side);
    this.ui.muzzleFlash();
    audio.playShot(w.def.pitchAudio);

    // Streuung als kleine NDC-Auslenkung des Strahls, ausgehend vom Zielpunkt
    // (Bildmitte bei Pointer-Lock, Mauszeiger im Cursor-Modus).
    const spreadRad = THREE.MathUtils.degToRad(kick.spread);
    const halfFov = THREE.MathUtils.degToRad(settings.fov) / 2;
    const ndcScale = spreadRad / halfFov;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * ndcScale;
    const bx = this.cursorAim ? this.mouseNDC.x : 0;
    const by = this.cursorAim ? this.mouseNDC.y : 0;
    const ndc = { x: bx + Math.cos(ang) * rad, y: by + Math.sin(ang) * rad };

    const hit = this.mode.raycast(this.camera, ndc);
    if (hit) {
      this.stats.hits++;
      const res = this.mode.applyHit(hit, kick.damage);
      this.stats.score += res.points;
      this.ui.hitmarker(res.kill);
      audio.playHit(res.kill);
    }
    this.ui.updateWeapon(w);
  }

  // ---------------- Loop ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1; // Schutz nach Tab-Wechsel

    // Optionaler 60-FPS-Cap (für 120/144Hz-Displays).
    if (settings.fpsCap) {
      this.capAccum += dt;
      if (this.capAccum < 1 / 60.5) { this.render(); return; }
      dt = this.capAccum;
      if (dt > 0.1) dt = 0.1;
      this.capAccum = 0;
    }

    // FPS-Messung
    if (dt > 0) {
      this.fpsSmooth += ((1 / dt) - this.fpsSmooth) * 0.1;
    }

    if (this.state === 'playing') {
      this.update(dt);
    }
    this.render();
  }

  update(dt) {
    this._emptyClickCd -= dt;
    this.weapon.update(dt);
    this.handleFiring();

    this.player.update(dt, this.keys, this.weapon.def.recover);
    if (this.mode) this.mode.update(dt);

    // Timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endRound();
    }

    // HUD (gedrosselt)
    this._hudAccum += dt;
    if (this._hudAccum >= 0.05) {
      this._hudAccum = 0;
      this.ui.updateHud({
        time: this.timeLeft,
        score: this.stats.score,
        accuracy: this.stats.accuracy(),
        avgReaction: this.stats.avgReaction(),
        kills: this.stats.kills,
      });
      if (this.mode.showHealth) this.ui.updateHealth(this.player.hp, this.player.maxHp);
      this.ui.updateFps(this.fpsSmooth);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
