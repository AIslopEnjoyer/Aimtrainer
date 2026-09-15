import * as THREE from 'three';
import { settings } from './settings.js';

const EYE = 1.7;
const MAX_SPEED = 8.5;       // m/s
const ACCEL = 60;
const FRICTION = 10;
const GRAVITY = 20;
const JUMP_V = 7.0;

// Bewegungsbereich, damit der Spieler zum Ausweichen strafen kann.
const BOUND = { xMin: -12, xMax: 12, zMin: -4, zMax: 12 };

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
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
    this.pos.set(0, EYE, 6);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.hp = this.maxHp;
    this.apply();
  }

  // Maus-Input (Pointer Lock deltas).
  onMouse(dx, dy) {
    const s = settings.sensitivity * 0.0022;
    this.yaw -= dx * s;
    const invert = settings.invertY ? 1 : -1;
    this.pitch += dy * s * invert;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // Recoil-Kick (in Grad) hinzufügen.
  addRecoil(upDeg, sideDeg) {
    this.recoilPitch += THREE.MathUtils.degToRad(upDeg);
    this.recoilYaw += THREE.MathUtils.degToRad(sideDeg);
  }

  speed2D() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  update(dt, keys, recoverSpeed) {
    // ---- Recoil-Recovery ----
    const decay = Math.exp(-recoverSpeed * dt);
    this.recoilPitch *= decay;
    this.recoilYaw *= decay;

    // ---- Bewegung (yaw-basierte Wunschrichtung) ----
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = -z bei yaw 0
    const fwd = { x: -sin, z: -cos };
    const right = { x: cos, z: -sin };
    let wishX = 0, wishZ = 0;
    if (keys.has('KeyW')) { wishX += fwd.x; wishZ += fwd.z; }
    if (keys.has('KeyS')) { wishX -= fwd.x; wishZ -= fwd.z; }
    if (keys.has('KeyD')) { wishX += right.x; wishZ += right.z; }
    if (keys.has('KeyA')) { wishX -= right.x; wishZ -= right.z; }
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) { wishX /= wishLen; wishZ /= wishLen; }

    // Beschleunigung / Reibung
    if (wishLen > 0) {
      this.vel.x += wishX * ACCEL * dt;
      this.vel.z += wishZ * ACCEL * dt;
      const sp = this.speed2D();
      if (sp > MAX_SPEED) {
        const f = MAX_SPEED / sp;
        this.vel.x *= f; this.vel.z *= f;
      }
    } else {
      const drop = 1 - Math.min(1, FRICTION * dt);
      this.vel.x *= drop;
      this.vel.z *= drop;
    }

    // Sprung / Schwerkraft
    if (keys.has('Space') && this.onGround) {
      this.vel.y = JUMP_V;
      this.onGround = false;
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

  apply() {
    this.camera.position.copy(this.pos);
    this._euler.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    // Weltmatrix sofort aktualisieren, damit Raycasts (Treffererkennung)
    // exakt der aktuellen Blickrichtung entsprechen (kein Frame-Lag).
    this.camera.updateMatrixWorld(true);
  }
}
