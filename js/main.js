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
    this.ui.on('resume', () => this.requestLock());
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
      if (this.state === 'playing' && this.isLocked()) {
        this.player.onMouse(e.movementX || 0, e.movementY || 0);
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || !this.isLocked()) return;
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
        if (e.code === 'Escape') { /* Pointer-Lock verlässt automatisch -> pause */ }
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
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  onLockChange() {
    if (this.isLocked()) {
      if (this.state === 'paused') {
        this.state = 'playing';
        this.ui.showScreen(null);
        this.lastTime = performance.now();
      }
    } else {
      // Lock verloren -> pausieren (außer wir sind eh im Menü/Ergebnis).
      if (this.state === 'playing') {
        this.state = 'paused';
        this.firing = false;
        this.ui.showScreen('pause');
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
    this.player.addRecoil(kick.up, kick.side);
    this.ui.muzzleFlash();
    audio.playShot(w.def.pitchAudio);

    // Streuung als kleine NDC-Auslenkung des Strahls.
    const spreadRad = THREE.MathUtils.degToRad(kick.spread);
    const halfFov = THREE.MathUtils.degToRad(settings.fov) / 2;
    const ndcScale = spreadRad / halfFov;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * ndcScale;
    const ndc = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad };

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
