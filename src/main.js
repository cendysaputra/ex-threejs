import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudioEnvironment } from './environment.js';
import { createRobot } from './robot.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.75, 9.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.08, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 12;
controls.update();

// --- lights: soft white key, baby-blue from the right, pink from the left ---
const key = new THREE.DirectionalLight('#fffaf8', 2.4);
key.position.set(-5.5, 7, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2;
key.shadow.camera.right = 2;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -1;
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.radius = 6;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

const blue = new THREE.DirectionalLight('#45acff', 3.6);
blue.position.set(6, 2, 0.8);
scene.add(blue);

const fill = new THREE.DirectionalLight('#fbf7ff', 0.9);
fill.position.set(0.5, 1.5, 8);
scene.add(fill);

const pink = new THREE.DirectionalLight('#ff8fcb', 1.8);
pink.position.set(-6, -3, 2.5);
scene.add(pink);

// --- robot ---
const robot = createRobot();
robot.rotation.y = -0.34;
scene.add(robot);

const { neckY, neck, eyes, ears, antennae, arms, barGlow } = robot.userData;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // keep the whole robot in frame on narrow screens
  const fit = Math.max(1, 0.7 / camera.aspect);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(14)) * fit));
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// --- idle animation ---
const timer = new THREE.Timer();
let nextBlink = 2.5;

function blinkAmount(t) {
  // quick close/open lasting ~0.18s
  const d = t - nextBlink;
  if (d < 0) return 0;
  if (d > 0.18) {
    nextBlink = t + 2.5 + Math.random() * 3;
    return 0;
  }
  return Math.sin((d / 0.18) * Math.PI);
}

// Wave with the arm nearest the viewer: automatically every few seconds, or on tap.
const WAVE_RAISE = 0.45;
const WAVE_HOLD = 2.4;
const WAVE_LOWER = 0.55;
const WAVE_LEN = WAVE_RAISE + WAVE_HOLD + WAVE_LOWER;
let waveStart = 1.5;

const easeInOut = (x) => x * x * (3 - 2 * x);

function waveAmount(t) {
  const d = t - waveStart;
  if (d < 0 || d > WAVE_LEN) return { lift: 0, wiggle: 0 };
  let lift = 1;
  if (d < WAVE_RAISE) lift = easeInOut(d / WAVE_RAISE);
  else if (d > WAVE_RAISE + WAVE_HOLD) lift = easeInOut(1 - (d - WAVE_RAISE - WAVE_HOLD) / WAVE_LOWER);
  return { lift, wiggle: Math.sin(Math.max(0, d - WAVE_RAISE * 0.6) * Math.PI * 4.4) };
}

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || still) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  const t = timer.getElapsed();
  if (moved < 6 && t - waveStart > WAVE_LEN) waveStart = t;
  downAt = null;
});

function animateArms(t) {
  const { lift, wiggle } = waveAmount(t);
  if (t - waveStart > WAVE_LEN) waveStart = t + 5 + Math.random() * 4;
  for (const arm of arms) {
    const { side, rest } = arm.userData;
    const sway = Math.sin(t * 1.3 + side) * 0.06;
    let z = rest.z + side * sway;
    let x = rest.x + Math.sin(t * 1.1 + side * 0.5) * 0.04;
    if (side > 0) {
      z = THREE.MathUtils.lerp(z, 1.85 + wiggle * 0.3, lift);
      x = THREE.MathUtils.lerp(x, 0.35, lift);
    }
    arm.rotation.set(x, 0, z);
  }
  return lift;
}

function animate() {
  timer.update();
  const t = timer.getElapsed();
  controls.update();

  if (!still) {
    neck.position.y = neckY + Math.sin(t * 1.6) * 0.012;
    const lift = animateArms(t);
    neck.rotation.z = Math.sin(t * 0.8) * 0.035 - lift * 0.07;
    neck.rotation.x = Math.sin(t * 0.6 + 1) * 0.02;
    antennae.forEach((a, i) => {
      a.rotation.z = (i ? -1 : 1) * (Math.sin(t * 2.4 + i) * 0.05);
    });
    const b = blinkAmount(t);
    for (const e of eyes) e.scale.y = 1 - 0.88 * b;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    barGlow.material.opacity = 0.15 + 0.15 * pulse;
    for (const ear of ears) ear.children[1].material.emissiveIntensity = 0.62 + 0.15 * pulse;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
