import * as THREE from 'three';

// Ego-Perspektive-Waffenmodell. Wird in einer eigenen Szene mit eigener Kamera
// (festes FOV) nach der Hauptszene gerendert, damit es weder in Wände clippt
// noch beim ADS-Zoom mitzoomt.
//
// Konvention: Der Ursprung jedes Modells liegt auf der Visierlinie (Mitte des
// hinteren Visiers). Im ADS wird das Modell daher einfach auf (0, 0, -adsDist)
// gesetzt und das Visier liegt exakt in der Bildmitte.

const VM_FOV = 58;

const mats = {
  body: new THREE.MeshStandardMaterial({ color: 0x5b6270, roughness: 0.5, metalness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.5, metalness: 0.4 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.9, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.4, metalness: 0.6 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4a62a, roughness: 0.4, metalness: 0.8 }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  flash: new THREE.MeshBasicMaterial({
    color: 0xffc060, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  }),
};

function box(g, w, h, d, x, y, z, mat, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  g.add(m);
  return m;
}

function cyl(g, r, len, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
  m.rotation.x = Math.PI / 2; // entlang z
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// Rotes-Punkt-Visier: Rahmen um den Ursprung + Leuchtpunkt in der Mitte.
function holoSight(g) {
  box(g, 0.044, 0.004, 0.012, 0, 0.0185, 0, mats.dark);
  box(g, 0.044, 0.004, 0.012, 0, -0.0185, 0, mats.dark);
  box(g, 0.004, 0.041, 0.012, 0.0185, 0, 0, mats.dark);
  box(g, 0.004, 0.041, 0.012, -0.0185, 0, 0, mats.dark);
  box(g, 0.016, 0.03, 0.02, 0, -0.033, 0, mats.dark);           // Fuß unter dem Rahmen
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0013, 10), mats.dot);
  dot.position.set(0, 0, -0.002);
  g.add(dot);
}

function buildR99() {
  const g = new THREE.Group();
  box(g, 0.056, 0.085, 0.32, 0, -0.085, -0.15, mats.body);
  box(g, 0.058, 0.012, 0.2, 0, -0.047, -0.2, mats.orange);       // Akzentstreifen
  box(g, 0.05, 0.05, 0.12, 0, -0.09, 0.07, mats.dark);          // Schulterstütze
  cyl(g, 0.016, 0.24, 0, -0.045, -0.44, mats.steel);            // Lauf
  cyl(g, 0.022, 0.05, 0, -0.045, -0.57, mats.dark);             // Mündung
  box(g, 0.036, 0.13, 0.05, 0, -0.16, -0.2, mats.dark, 0.12);   // Magazin
  box(g, 0.04, 0.1, 0.046, 0, -0.145, -0.04, mats.grip, 0.3);   // Griff
  holoSight(g);
  return { group: g, muzzle: new THREE.Vector3(0, -0.045, -0.6), adsDist: 0.26, zoom: 1.25, kick: 1 };
}

function buildFlatline() {
  const g = new THREE.Group();
  box(g, 0.062, 0.095, 0.44, 0, -0.09, -0.2, mats.body);
  box(g, 0.064, 0.012, 0.26, 0, -0.047, -0.25, mats.gold);
  box(g, 0.05, 0.06, 0.15, 0, -0.095, 0.1, mats.dark);          // Schaft
  cyl(g, 0.017, 0.34, 0, -0.05, -0.59, mats.steel);
  cyl(g, 0.024, 0.07, 0, -0.05, -0.78, mats.dark);
  box(g, 0.04, 0.17, 0.06, 0, -0.19, -0.26, mats.dark, 0.35);   // langes, gebogenes Magazin
  box(g, 0.042, 0.1, 0.048, 0, -0.15, -0.03, mats.grip, 0.3);
  holoSight(g);
  return { group: g, muzzle: new THREE.Vector3(0, -0.05, -0.82), adsDist: 0.3, zoom: 1.5, kick: 1.15 };
}

function buildWingman() {
  const g = new THREE.Group();
  box(g, 0.042, 0.06, 0.26, 0, -0.05, -0.12, mats.steel);       // Schlitten
  box(g, 0.04, 0.045, 0.1, 0, -0.065, -0.04, mats.body);
  cyl(g, 0.013, 0.2, 0, -0.045, -0.3, mats.steel);              // Lauf
  box(g, 0.058, 0.07, 0.07, 0, -0.07, -0.16, mats.dark);        // Trommel
  box(g, 0.04, 0.12, 0.05, 0, -0.14, 0.0, mats.grip, 0.35);     // Griff
  box(g, 0.012, 0.014, 0.01, 0.012, -0.002, 0, mats.dark);      // Kimme links
  box(g, 0.012, 0.014, 0.01, -0.012, -0.002, 0, mats.dark);     // Kimme rechts
  box(g, 0.006, 0.026, 0.01, 0, -0.012, -0.36, mats.dark);      // Korn: Spitze liegt auf y = 0.001
  return { group: g, muzzle: new THREE.Vector3(0, -0.045, -0.42), adsDist: 0.2, zoom: 1.4, kick: 1.8 };
}

const BUILDERS = { r99: buildR99, flatline: buildFlatline, wingman: buildWingman };

// Hüft-Position (rechts unten) – ADS ist (0, 0, -adsDist).
const HIP = new THREE.Vector3(0.15, -0.15, -0.34);

const easeInOut = (t) => t * t * (3 - 2 * t);

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VM_FOV, window.innerWidth / window.innerHeight, 0.02, 10);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xeef3ff, 0x6a7080, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.5, 1, 0.6);
    this.scene.add(key);

    this.root = new THREE.Group();   // Position/Animation
    this.scene.add(this.root);

    this.flashMesh = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mats.flash);
    const p2 = p1.clone();
    p2.rotation.z = Math.PI / 4;
    this.flashMesh.add(p1, p2);
    this.flashMesh.visible = false;
    this.flashMesh.renderOrder = 10;
    this.flashT = 0;

    this.kickZ = 0;
    this.kickRot = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.bobT = 0;
    this.model = null;
    this.setWeapon('r99');

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  setWeapon(id) {
    if (this.model) this.root.remove(this.model.group);
    this.model = (BUILDERS[id] || buildR99)();
    this.model.group.add(this.flashMesh);
    this.flashMesh.position.copy(this.model.muzzle);
    this.root.add(this.model.group);
    this.kickZ = this.kickRot = 0;
    this.flashT = 0;
    this.flashMesh.visible = false;
  }

  get zoom() { return this.model.zoom; }

  // Rückstoß-Animation. adsT dämpft den Effekt, damit das Visier ruhig bleibt.
  kick(adsT) {
    const k = this.model.kick * (1 - adsT * 0.6);
    this.kickZ += 0.022 * k;
    this.kickRot += 0.035 * k;
    this.flashT = 0.045;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
    this.flashMesh.scale.setScalar((0.7 + Math.random() * 0.6) * (1 - adsT * 0.7));
  }

  // Maus-Delta für leichtes Nachschwingen der Waffe.
  look(dx, dy) {
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.00006, -0.02, 0.02);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.00006, -0.02, 0.02);
  }

  update(dt, { adsT, speed, onGround, reloadProgress }) {
    const e = easeInOut(adsT);
    const hip = 1 - e;

    this.kickZ *= Math.exp(-16 * dt);
    this.kickRot *= Math.exp(-14 * dt);
    this.swayX *= Math.exp(-9 * dt);
    this.swayY *= Math.exp(-9 * dt);

    // Lauf-Wippen nur auf dem Boden und kaum im ADS.
    let bobX = 0, bobY = 0;
    if (onGround && speed > 0.5) {
      this.bobT += dt * (6 + speed * 0.9);
      bobX = Math.sin(this.bobT) * 0.006 * hip;
      bobY = Math.abs(Math.cos(this.bobT)) * 0.007 * hip;
    }

    // Nachladen: Waffe taucht nach unten weg und kippt.
    const rl = reloadProgress > 0 ? Math.sin(Math.min(1, reloadProgress) * Math.PI) : 0;

    const ads = this.model.adsDist;
    const x = THREE.MathUtils.lerp(HIP.x, 0, e) + bobX + this.swayX;
    const y = THREE.MathUtils.lerp(HIP.y, 0, e) + bobY + this.swayY - rl * 0.1;
    const z = THREE.MathUtils.lerp(HIP.z, -ads, e) + this.kickZ;
    this.root.position.set(x, y, z);
    this.root.rotation.set(this.kickRot - rl * 0.45, -0.05 * hip + rl * 0.2, -rl * 0.35 + this.swayX * 4);

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashMesh.visible = this.flashT > 0;
    }
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
