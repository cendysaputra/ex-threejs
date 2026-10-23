import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudioEnvironment } from './environment.js';
import { createAnimator } from './animation.js';
import { createRobot } from './robot.js';
import { makeBlobTexture, makeFloorTexture } from './textures.js';
import { createToys } from './toys.js';

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
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 2.95, 9.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.38, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 12;
controls.update();
// orbit around and up over the robot, but never lower than the starting view
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = controls.getPolarAngle();

// --- lights: a soft white studio: key from the upper left, fill from the right, rim behind ---
// The light rig (and the studio reflections) turns with the camera, so the robot keeps
// the same look from every angle, like a product shot on a turntable.
const rig = new THREE.Group();
rig.position.copy(controls.target);
scene.add(rig);
const cameraStart = camera.quaternion.clone().invert();

const key = new THREE.DirectionalLight('#fffaf8', 2.6);
key.position.set(-5.5, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.left = -4.6;
key.shadow.camera.right = 4.6;
key.shadow.camera.top = 4.6;
key.shadow.camera.bottom = -4.6;
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.radius = 3;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
rig.add(key, key.target);

const fill = new THREE.DirectionalLight('#fff7fa', 1.3);
fill.position.set(6, 1.5, 3);
const front = new THREE.DirectionalLight('#ffffff', 0.5);
front.position.set(0.5, 0.5, 8);
const rim = new THREE.DirectionalLight('#fff4f8', 1.2);
rim.position.set(-3, 2.5, -6);
rig.add(fill, front, rim);
for (const light of [fill, front, rim]) rig.add(light.target);

function updateRig() {
  rig.quaternion.multiplyQuaternions(camera.quaternion, cameraStart);
  scene.environmentRotation.setFromQuaternion(rig.quaternion);
}

// --- robot ---
const robot = createRobot();
robot.rotation.y = 0.38; // turned a little to its left, as in the reference
scene.add(robot);

// faint contact shadow under the robot's feet
const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.2, 1.6).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    map: makeBlobTexture(),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  }),
);
contactShadow.position.set(robot.position.x, 0.002, 0.05);
scene.add(contactShadow);

// floor: a pastel polka-dot play mat covering the whole floor and fading into the
// white background in the distance. It is drawn unlit and underneath everything,
// with a shadow catcher on top of it.
scene.fog = new THREE.Fog('#ffffff', 14, 40);
const FLOOR_SIZE = 120;
const DOT_SPACING = 0.78; // world size of one floor tile (two dots)
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    map: makeFloorTexture(DOT_SPACING, FLOOR_SIZE / DOT_SPACING),
    toneMapped: false,
    depthWrite: false,
  }),
);
floor.renderOrder = -1;
scene.add(floor);

const floorShadows = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ color: '#6f5fa8', opacity: 0.2, depthWrite: false }),
);
floorShadows.receiveShadow = true;
floorShadows.renderOrder = -1;
scene.add(floorShadows);

function updateContactShadow() {
  // a hop lifts the robot off the floor: the shadow fades and shrinks a little
  const air = animator.air;
  contactShadow.material.opacity = 0.12 * (1 - Math.min(0.6, air * 6));
  contactShadow.scale.setScalar(1 - Math.min(0.3, air * 2));
}

// keep the page at 100%: block pinch and ctrl/cmd + wheel/plus/minus browser zoom.
// (ctrl/cmd + 0 still works, so a page that was already zoomed can be reset.)
window.addEventListener('wheel', (e) => (e.ctrlKey || e.metaKey) && e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key)) e.preventDefault();
});
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // keep the robot and its toys in frame on narrow screens (phones can pinch out for the outer toys)
  const fit = THREE.MathUtils.clamp(1.35 / camera.aspect, 1, 1.75);
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(14)) * fit));
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// --- animation ---
const timer = new THREE.Timer();
const animator = createAnimator(robot);

// toys around the robot; tapping the robot makes it wave, or have another go at standing
const toys = createToys({
  scene,
  camera,
  canvas: renderer.domElement,
  controls,
  robot,
  animator,
  onRobotTap: () => !still && animator.tap(timer.getElapsed()),
});
if (still) toys.update(0, 0);

// keep the framing centred as the robot stands up
const baseTargetY = controls.target.y;
function followRobot() {
  const delta = baseTargetY + animator.lift * 0.5 - controls.target.y;
  controls.target.y += delta;
  camera.position.y += delta;
  rig.position.copy(controls.target);
}

function animate() {
  timer.update();
  const t = timer.getElapsed();
  const dt = timer.getDelta();
  controls.update();
  updateRig();

  if (!still) {
    animator.update(t, dt);
    toys.update(t, dt);
    followRobot();
    updateContactShadow();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
