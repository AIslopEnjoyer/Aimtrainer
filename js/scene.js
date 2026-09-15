import * as THREE from 'three';
import { settings } from './settings.js';

// Baut Renderer, Szene, Kamera und eine schlichte Apex-artige Trainings-Arena.
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: settings.antialias && !settings.perfMode,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setClearColor(0x0b0e13, 1);
  applyRendererQuality(renderer);
  renderer.shadowMap.enabled = settings.shadows && !settings.perfMode;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e13);
  scene.fog = new THREE.Fog(0x0b0e13, 45, 130);

  const camera = new THREE.PerspectiveCamera(settings.fov, aspect(), 0.1, 500);
  camera.position.set(0, 1.7, 0);

  // ---- Licht (bewusst günstig gehalten für 60 FPS) ----
  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x2a2f3a, 1.25);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.35);
  dir.position.set(-30, 50, 20);
  // Schatten-Setup immer vorbereiten, damit es live (per renderer.shadowMap.enabled) umschaltbar ist.
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 140;
  dir.shadow.camera.left = -60;
  dir.shadow.camera.right = 60;
  dir.shadow.camera.top = 60;
  dir.shadow.camera.bottom = -60;
  dir.shadow.bias = -0.0005;
  scene.add(dir);

  // ---- Boden ----
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.95, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Gitter für Tiefenwahrnehmung / Sensitivitätsgefühl
  const grid = new THREE.GridHelper(200, 80, 0x2a3446, 0x1c2431);
  grid.position.y = 0.01;
  scene.add(grid);

  // ---- Rückwand + Seitenwände (Trainingsraum) ----
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x2a3547, roughness: 0.8, emissive: 0x0a0d12 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(120, 30, 1), wallMat);
  backWall.position.set(0, 15, -45);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 90), wallMat);
  leftWall.position.set(-40, 15, -10);
  scene.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = 40;
  scene.add(rightWall);

  // Ein paar Deko-Pfeiler / Cover als Orientierung
  const pillarGeo = new THREE.BoxGeometry(2.4, 6, 2.4);
  for (const x of [-22, 22]) {
    for (const z of [-30, -18]) {
      const p = new THREE.Mesh(pillarGeo, accentMat);
      p.position.set(x, 3, z);
      p.castShadow = true;
      scene.add(p);
    }
  }

  // Akzentstreifen an der Rückwand (Apex-Feeling)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.5, 1.05),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b })
  );
  stripe.position.set(0, 6, -44.9);
  scene.add(stripe);

  function aspect() {
    return (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize, dir };
}

export function applyRendererQuality(renderer) {
  const ratio = settings.perfMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(ratio);
}
