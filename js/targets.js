import * as THREE from 'three';
import { settings } from './settings.js';

// Trainingsbereich (vor dem Spieler, der bei (0,1.7,0) steht und nach -z schaut).
export const ZONE = {
  xMin: -15, xMax: 15,
  yMin: 1.2, yMax: 6.5,
  zMin: -38, zMax: -20,
};

const BASE_RADIUS = 0.55;

function rand(min, max) { return min + Math.random() * (max - min); }

// Einzelnes kugelförmiges Ziel.
class Target {
  constructor() {
    const geo = new THREE.SphereGeometry(1, 20, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      emissive: 0xff2b2b,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.userData.target = this;
    this.radius = BASE_RADIUS;
    this.alive = false;
    this.hp = 1;
    this.maxHp = 1;
    this.vx = 0;
    this.baseY = 3;
    this.phase = Math.random() * Math.PI * 2;
    this.spawnTime = 0;
  }

  setScale(r) {
    this.radius = r;
    this.mesh.scale.setScalar(r);
  }

  spawn(pos, hp = 1) {
    this.mesh.position.copy(pos);
    this.baseY = pos.y;
    this.hp = hp;
    this.maxHp = hp;
    this.alive = true;
    this.mesh.visible = true;
    this.mesh.material.color.setHex(0xff3b3b);
    this.mesh.material.emissive.setHex(0xff2b2b);
    this.spawnTime = performance.now();
  }

  kill() {
    this.alive = false;
    this.mesh.visible = false;
  }

  // Schaden zufügen; liefert true bei Kill.
  damage(amount) {
    this.hp -= amount;
    // Farbverlauf rot -> gelb bei sinkender HP
    const t = Math.max(0, this.hp / this.maxHp);
    this.mesh.material.color.setRGB(1, 0.23 + (1 - t) * 0.6, 0.23);
    if (this.hp <= 0) {
      this.kill();
      return true;
    }
    return false;
  }
}

export class TargetManager {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    this.active = [];
    this._raycaster = new THREE.Raycaster();
  }

  _get() {
    let t = this.pool.pop();
    if (!t) {
      t = new Target();
      this.group.add(t.mesh);
    }
    t.setScale(BASE_RADIUS * settings.targetScale);
    return t;
  }

  clear() {
    for (const t of this.active) {
      t.kill();
      this.pool.push(t);
    }
    this.active.length = 0;
  }

  count() { return this.active.length; }

  spawnRandom(hp = 1, opts = {}) {
    const t = this._get();
    const r = t.radius;
    const pos = new THREE.Vector3(
      rand(ZONE.xMin + r, ZONE.xMax - r),
      rand(ZONE.yMin + r, ZONE.yMax - r),
      opts.z != null ? opts.z : rand(ZONE.zMin, ZONE.zMax)
    );
    t.spawn(pos, hp);
    if (opts.moving) {
      t.vx = rand(3, 7) * (Math.random() < 0.5 ? -1 : 1);
    } else {
      t.vx = 0;
    }
    this.active.push(t);
    return t;
  }

  // Weit auseinander platzierte Ziele (Target Switching).
  spawnSpread(index, total, hp = 1) {
    const t = this._get();
    const r = t.radius;
    const span = (ZONE.xMax - ZONE.xMin - 2 * r);
    const step = span / Math.max(1, total);
    const x = ZONE.xMin + r + step * (index + 0.5) + rand(-step * 0.2, step * 0.2);
    const pos = new THREE.Vector3(
      THREE.MathUtils.clamp(x, ZONE.xMin + r, ZONE.xMax - r),
      rand(ZONE.yMin + r, ZONE.yMax - r),
      rand(ZONE.zMin, ZONE.zMax)
    );
    t.spawn(pos, hp);
    this.active.push(t);
    return t;
  }

  remove(target) {
    const i = this.active.indexOf(target);
    if (i >= 0) {
      this.active.splice(i, 1);
      target.kill();
      this.pool.push(target);
    }
  }

  update(dt) {
    for (const t of this.active) {
      if (t.vx !== 0) {
        t.mesh.position.x += t.vx * dt;
        const r = t.radius;
        if (t.mesh.position.x <= ZONE.xMin + r) { t.mesh.position.x = ZONE.xMin + r; t.vx = Math.abs(t.vx); }
        if (t.mesh.position.x >= ZONE.xMax - r) { t.mesh.position.x = ZONE.xMax - r; t.vx = -Math.abs(t.vx); }
        // gelegentlicher Richtungs-/Tempowechsel für unvorhersehbares Tracking
        if (Math.random() < 0.6 * dt) t.vx = rand(3, 8) * (Math.random() < 0.5 ? -1 : 1);
        // leichtes vertikales Wippen
        t.phase += dt * 2;
        t.mesh.position.y = t.baseY + Math.sin(t.phase) * 0.4;
      }
    }
  }

  // Raycast gegen alle aktiven Ziele. Liefert {target, point, isHead, distance} oder null.
  raycast(camera, ndc = { x: 0, y: 0 }) {
    // Weltmatrizen der (evtl. bewegten) Ziele auf den aktuellen Frame bringen.
    this.group.updateMatrixWorld(true);
    this._raycaster.setFromCamera(ndc, camera);
    const meshes = this.active.map((t) => t.mesh);
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const target = hit.object.userData.target;
    // Headshot: oberes Drittel der Kugel.
    const localY = hit.point.y - hit.object.position.y;
    const isHead = localY > target.radius * 0.35;
    return { target, point: hit.point, isHead, distance: hit.distance };
  }
}

// ---------------- Bot für das Strafe-Duell ----------------
export class Bot {
  constructor(scene) {
    this.group = new THREE.Group();
    // Körper (Kapsel) + Kopf
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff8a3b, roughness: 0.5, emissive: 0x301400 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd23b, roughness: 0.4, emissive: 0x332200 });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 6, 12), bodyMat);
    this.body.position.y = 1.1;
    this.body.castShadow = true;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), headMat);
    this.head.position.y = 2.15;
    this.head.castShadow = true;
    this.body.userData.bot = this;
    this.body.userData.part = 'body';
    this.head.userData.bot = this;
    this.head.userData.part = 'head';
    this.group.add(this.body, this.head);
    scene.add(this.group);
    this.group.visible = false;

    this._raycaster = new THREE.Raycaster();
    this.maxHp = 120;
    this.reset();
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.group.visible = true;
    this.x = 0;
    this.z = -28;
    this.y = 0;
    this.vy = 0;
    this.vx = rand(4, 8) * (Math.random() < 0.5 ? -1 : 1);
    this.jumpCd = rand(0.8, 2.0);
    this.fireCd = 1.2;
    this._updateMesh();
    this._setColor(1);
  }

  _setColor(t) {
    // rot bei viel HP -> heller/blasser bei Kill nicht nötig; Kopf bleibt gelb
    this.body.material.color.setRGB(1, 0.4 + (1 - t) * 0.4, 0.23);
  }

  _updateMesh() {
    this.group.position.set(this.x, this.y, this.z);
  }

  damage(amount, isHead) {
    const dmg = isHead ? amount * 1.8 : amount;
    this.hp -= dmg;
    this._setColor(Math.max(0, this.hp / this.maxHp));
    if (this.hp <= 0) {
      this.alive = false;
      return { killed: true, isHead };
    }
    return { killed: false, isHead };
  }

  update(dt, playerSpeed, onShoot) {
    if (!this.alive) return;
    // Seitwärts strafen im Bereich
    this.x += this.vx * dt;
    if (this.x <= ZONE.xMin + 1) { this.x = ZONE.xMin + 1; this.vx = Math.abs(this.vx); }
    if (this.x >= ZONE.xMax - 1) { this.x = ZONE.xMax - 1; this.vx = -Math.abs(this.vx); }
    if (Math.random() < 0.8 * dt) this.vx = rand(4, 9) * (Math.random() < 0.5 ? -1 : 1);

    // Springen
    this.jumpCd -= dt;
    if (this.y === 0 && this.jumpCd <= 0) {
      this.vy = 6.5;
      this.jumpCd = rand(1.0, 2.4);
    }
    if (this.vy !== 0 || this.y > 0) {
      this.vy -= 18 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this._updateMesh();

    // Zurückschießen: Trefferchance sinkt, wenn der Spieler sich schnell bewegt.
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = rand(0.7, 1.3);
      const dodge = THREE.MathUtils.clamp(playerSpeed / 8, 0, 0.7);
      const hitChance = 0.55 * (1 - dodge);
      if (Math.random() < hitChance) {
        onShoot(rand(7, 13)); // Schaden am Spieler
      } else {
        onShoot(0); // Fehlschuss (nur Sound/Feedback)
      }
    }
  }

  // Raycast gegen Kopf/Körper. Liefert {isHead, point} oder null.
  raycast(camera, ndc = { x: 0, y: 0 }) {
    if (!this.alive) return null;
    this.group.updateMatrixWorld(true);
    this._raycaster.setFromCamera(ndc, camera);
    const hits = this._raycaster.intersectObjects([this.head, this.body], false);
    if (!hits.length) return null;
    return { isHead: hits[0].object.userData.part === 'head', point: hits[0].point };
  }

  hide() {
    this.group.visible = false;
    this.alive = false;
  }
}
