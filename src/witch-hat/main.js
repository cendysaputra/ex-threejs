import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWitchHat } from './model.js';
import { createHatAnimator } from './animation.js';
import { createEffects } from './effects.js';
import { createStudioEnvironment } from '../environment.js';

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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
mount.append(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.38;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.9, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.8;
scene.add(new THREE.HemisphereLight('#eee8ff', '#685079', 0.4));
const key = new THREE.DirectionalLight('#fff7f0', 3.2);
key.position.set(-4.5, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -3, near: 1, far: 20 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.025;
key.shadow.radius = 5;
key.shadow.blurSamples = 8;
scene.add(key);
const rim = new THREE.DirectionalLight('#dbc1ff', 2.0);
rim.position.set(4, 4, -3);
scene.add(rim);
const fill = new THREE.DirectionalLight('#d7dbff', 0.7);
fill.position.set(4, 2, 6);
scene.add(fill);

const hat = createWitchHat();
scene.add(hat.root);
const animator = createHatAnimator(hat);
const effects = createEffects(scene);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const still = new URLSearchParams(location.search).has('still');
let paused = motionPreference.matches || still;
let visible = !document.hidden;
const pauseButton = document.querySelector('#pause');
function showPauseState() {
  pauseButton.textContent = paused ? 'Lanjut animasi' : 'Jeda animasi';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
showPauseState();
effects.setReducedMotion(motionPreference.matches || still);
motionPreference.addEventListener('change', (event) => {
  paused = event.matches || still;
  effects.setReducedMotion(event.matches || still);
  showPauseState();
});
pauseButton.addEventListener('click', () => {
  paused = !paused;
  showPauseState();
});
document.querySelector('#blink').addEventListener('click', () => {
  paused = false;
  showPauseState();
  animator.blink();
});

let homePosition;
document.querySelector('#reset').addEventListener('click', () => {
  camera.position.copy(homePosition);
  controls.target.set(0, 1.9, 0);
  controls.update();
  animator.resetLook();
});
renderer.domElement.addEventListener('pointermove', (event) => {
  animator.lookAt((event.clientX / innerWidth - 0.5) * 2, (0.5 - event.clientY / innerHeight) * 2);
});
renderer.domElement.addEventListener('pointerleave', () => animator.resetLook());
const raycaster = new THREE.Raycaster();
let pointerDown;
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
renderer.domElement.addEventListener('pointercancel', () => {
  pointerDown = undefined;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (
    !pointerDown ||
    pointerDown.id !== event.pointerId ||
    Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8
  )
    return;
  pointerDown = undefined;
  raycaster.setFromCamera(
    new THREE.Vector2((event.clientX / innerWidth) * 2 - 1, 1 - (event.clientY / innerHeight) * 2),
    camera,
  );
  if (raycaster.intersectObject(hat.root, true).length) {
    paused = false;
    showPauseState();
    animator.enchant();
  }
});

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  camera.aspect = w / h;
  const mobile = w < 701;
  const distance = mobile
    ? Math.max(13, 6.9 / (w / h) / (2 * Math.tan(THREE.MathUtils.degToRad(43 / 2))))
    : 11.8;
  controls.maxDistance = Math.max(20, distance * 1.4);
  camera.position.set(0, 3.25, distance);
  homePosition = camera.position.clone();
  camera.fov = mobile ? 43 : 32;
  camera.setViewOffset(w, h, mobile ? 0 : -w * 0.13, mobile ? -h * 0.13 : 0, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  effects.setPixelRatio(renderer.getPixelRatio());
  controls.update();
}
addEventListener('resize', resize);
resize();
const timer = new THREE.Timer();
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
});
renderer.setAnimationLoop(() => {
  timer.update();
  if (!visible) return;
  if (!paused) animator.update(Math.min(timer.getDelta(), 0.05));
  effects.update(animator.time);
  rim.intensity = 2.0 + Math.sin(animator.time * 0.7) * 0.12;
  controls.update();
  renderer.render(scene, camera);
});
status.hidden = true;
