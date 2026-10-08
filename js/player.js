import * as THREE from 'three';
import { settings } from './settings.js';

const EYE = 1.7;
const MAX_SPEED = 8.5;       // m/s
const GROUND_ACCEL = 70;     // m/s² Richtung Zielgeschwindigkeit (knackig, ~0.12 s bis Vollgas)
const GROUND_BRAKE = 95;     // m/s² beim Loslassen / Richtungswechsel -> kein Nachrutschen
const AIR_ACCEL = 14;        // m/s² in der Luft: Schwung bleibt erhalten, begrenzte Steuerung
const GRAVITY = 22;
const JUMP_V = 7.0;
const RECOIL_HOLD = 0.09;    // Sekunden nach dem letzten Schuss, bevor der Recoil zurückläuft
const RECOIL_FOLLOW = 38;    // wie schnell die Kamera dem Recoil-Ziel folgt (knackig, kein Federn)

// Bewegungsbereich, damit der Spieler zum Ausweichen strafen kann.
const BOUND = { xMin: -12, xMax: 12, zMin: -4, zMax: 12 };

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;       // sichtbarer Recoil (folgt dem Ziel)
    this.recoilYaw = 0;
    this.recoilTargetPitch = 0; // aufsummierter Recoil
    this.recoilTargetYaw = 0;
    this.sinceShot = 99;
    this.adsT = 0;              // 0 = Hüfte, 1 = voll im ADS (für Sensitivität/Tempo)
    this.zoomRatio = 1;         // Zoomfaktor im ADS (Sensitivität wird entsprechend skaliert)
    this.pos = new THREE.Vector3(0, EYE, 6);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.onGround = true;
    this.hp = 100;
    this.maxHp = 100;
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilTargetPitch = 0;
    this.recoilTargetYaw = 0;
    this.sinceShot = 99;
    this.adsT = 0;
    this.pos.set(0, EYE, 6);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.hp = this.maxHp;
    this.apply();
  }

  // Maus-Input (Pointer Lock deltas). Im ADS sinkt die Sensitivität mit dem Zoom,
  // damit sich das Zielen unabhängig vom Zoom gleich anfühlt.
  onMouse(dx, dy) {
    const adsScale = 1 / (1 + (this.zoomRatio - 1) * this.adsT);
    const s = settings.sensitivity * 0.0022 * adsScale;
    const invert = settings.invertY ? -1 : 1;
    // Blickänderung (positiv = nach oben / nach links)
    const dYaw = -dx * s;
    const dPitch = -dy * s * invert;
    // Gegensteuern gegen den Recoil verbraucht zuerst den Recoil, damit die Kamera
    // nach dem Loslassen nicht unter den Ausgangspunkt zurückfällt.
    this.yaw += this._consume('Yaw', dYaw);
    this.pitch += this._consume('Pitch', dPitch);
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  _consume(axis, d) {
    const t = 'recoilTarget' + axis;
    const a = 'recoil' + axis;
    if (this[t] * d < 0) {
      const c = Math.sign(d) * Math.min(Math.abs(d), Math.abs(this[t]));
      this[t] += c;
      this[a] += c;
      d -= c;
    }
    return d;
  }

  // Recoil-Kick (in Grad) hinzufügen.
  addRecoil(upDeg, sideDeg) {
    this.recoilTargetPitch += THREE.MathUtils.degToRad(upDeg);
    this.recoilTargetYaw += THREE.MathUtils.degToRad(sideDeg);
    this.sinceShot = 0;
  }

  speed2D() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  update(dt, keys, recoverSpeed, adsT = 0) {
    this.adsT = adsT;

    // ---- Recoil: hält während des Feuerns, läuft danach weich zurück ----
    this.sinceShot += dt;
    if (this.sinceShot > RECOIL_HOLD) {
      const decay = Math.exp(-recoverSpeed * dt);
      this.recoilTargetPitch *= decay;
      this.recoilTargetYaw *= decay;
    }
    const follow = 1 - Math.exp(-RECOIL_FOLLOW * dt);
    this.recoilPitch += (this.recoilTargetPitch - this.recoilPitch) * follow;
    this.recoilYaw += (this.recoilTargetYaw - this.recoilYaw) * follow;

    // ---- Bewegung (yaw-basierte Wunschrichtung) ----
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fwd = { x: -sin, z: -cos };    // forward = -z bei yaw 0
    const right = { x: cos, z: -sin };
    let wishX = 0, wishZ = 0;
    if (keys.has('KeyW')) { wishX += fwd.x; wishZ += fwd.z; }
    if (keys.has('KeyS')) { wishX -= fwd.x; wishZ -= fwd.z; }
    if (keys.has('KeyD')) { wishX += right.x; wishZ += right.z; }
    if (keys.has('KeyA')) { wishX -= right.x; wishZ -= right.z; }
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) { wishX /= wishLen; wishZ /= wishLen; }
    const wishSpeed = MAX_SPEED * (1 - 0.35 * adsT);

    // Sprung zuerst, damit der Absprung-Frame schon als "in der Luft" zählt.
    if (keys.has('Space') && this.onGround) {
      this.vel.y = JUMP_V;
      this.onGround = false;
    }

    const targetX = wishX * wishSpeed, targetZ = wishZ * wishSpeed;
    if (this.onGround) {
      // Läuft die Eingabe in Richtung der aktuellen Bewegung -> beschleunigen, sonst bremsen.
      const along = this.vel.x * wishX + this.vel.z * wishZ;
      const rate = wishLen > 0 && along >= 0 ? GROUND_ACCEL : GROUND_BRAKE;
      this._approach(targetX, targetZ, rate * dt);
    } else if (wishLen > 0) {
      this._approach(targetX, targetZ, AIR_ACCEL * dt);
    }

    this.vel.y -= GRAVITY * dt;

    // Position integrieren
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    if (this.pos.y <= EYE) { this.pos.y = EYE; this.vel.y = 0; this.onGround = true; }
    this.pos.x = Math.max(BOUND.xMin, Math.min(BOUND.xMax, this.pos.x));
    this.pos.z = Math.max(BOUND.zMin, Math.min(BOUND.zMax, this.pos.z));

    this.apply();
  }

  // Bewegt die horizontale Geschwindigkeit um höchstens `maxDelta` auf den Zielvektor zu.
  _approach(tx, tz, maxDelta) {
    const dx = tx - this.vel.x, dz = tz - this.vel.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6 || len <= maxDelta) { this.vel.x = tx; this.vel.z = tz; return; }
    this.vel.x += (dx / len) * maxDelta;
    this.vel.z += (dz / len) * maxDelta;
  }

  apply() {
    this.camera.position.copy(this.pos);
    this._euler.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    // Weltmatrix sofort aktualisieren, damit Raycasts (Treffererkennung)
    // exakt der aktuellen Blickrichtung entsprechen (kein Frame-Lag).
    this.camera.updateMatrixWorld(true);
  }
}
