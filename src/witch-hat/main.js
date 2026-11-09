import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mount = document.querySelector('#scene');
const status = document.querySelector('#scene-status');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (error) {
  status.textContent = 'WebGL tidak tersedia. Coba buka di browser dengan akselerasi grafis aktif.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor('#f7f3fa');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
mount.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.9, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.8;
scene.add(new THREE.HemisphereLight('#eadcff', '#4b2c68', 2));
const key = new THREE.DirectionalLight('#ffe9d0', 3);
key.position.set(-3, 7, 6);
scene.add(key);
const rim = new THREE.DirectionalLight('#d48dff', 2.5);
rim.position.set(4, 4, -3);
scene.add(rim);
const fill = new THREE.DirectionalLight('#a6b3ff', 0.8);
fill.position.set(-5, 2, -1);
scene.add(fill);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  camera.aspect = w / h;
  camera.position.set(0, 3.5, w < 701 ? 13.8 : 11.8);
  camera.fov = w < 701 ? 43 : 32;
  camera.setViewOffset(w, h, w < 701 ? 0 : -w * 0.13, w < 701 ? -h * 0.04 : 0, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  controls.update();
}
addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
status.hidden = true;
