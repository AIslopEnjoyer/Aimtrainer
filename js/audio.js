// Leichtgewichtige, synthetisierte Sounds via WebAudio – keine Asset-Dateien nötig.
import { settings } from './settings.js';

let ctx = null;
let master = null;

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}

function noiseBuffer(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Kurzer, knackiger Schuss: Noise-Burst + tiefer Sinus-Kick.
export function playShot(pitch = 1) {
  ensure();
  if (!ctx || settings.volume <= 0) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1600 * pitch;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.12);

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.1);
}

// Heller Treffer-Ping.
export function playHit(kill = false) {
  ensure();
  if (!ctx || settings.volume <= 0) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(kill ? 520 : 880, t);
  osc.frequency.exponentialRampToValueAtTime(kill ? 320 : 1200, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.13);
}

// Trockenes Klick, wenn Magazin leer.
export function playEmpty() {
  ensure();
  if (!ctx || settings.volume <= 0) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.03);
}

// Reload-Schwuppen.
export function playReload() {
  ensure();
  if (!ctx || settings.volume <= 0) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(440, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.2, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.26);
}

// Bot trifft den Spieler.
export function playHurt() {
  ensure();
  if (!ctx || settings.volume <= 0) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.17);
}
