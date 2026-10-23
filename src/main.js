import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudioEnvironment } from './environment.js';
import { createAnimator } from './animation.js';
import { createRobot } from './robot.js';
import { FLOOR_COLOR, makeBlobTexture, makeMatTexture } from './textures.js';
import { createToys } from './toys.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');
const CANVAS_WIDTH = 1200; // the scene is laid out for this width; narrower screens use their full width

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(Math.min(CANVAS_WIDTH, window.innerWidth), window.innerHeight);
renderer.setClearColor(0xffffff, 1);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 2.75, 9.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.08, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3.5;
controls.maxDistance = 12;
controls.update();
// orbit around and up over the robot, but never lower than the starting view
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = controls.getPolarAngle();

// --- lights: soft white key, baby-blue from the right, pink from the left ---
// The light rig (and the studio reflections) turns with the camera, so the robot keeps
// the same look from every angle, like a product shot on a turntable.
const rig = new THREE.Group();
rig.position.copy(controls.target);
scene.add(rig);
const cameraStart = camera.quaternion.clone().invert();

const key = new THREE.DirectionalLight('#fffaf8', 2.8);
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

const blue = new THREE.DirectionalLight('#45acff', 3.6);
blue.position.set(6, 1, 0.8);
const fill = new THREE.DirectionalLight('#fbf7ff', 0.4);
fill.position.set(0.5, 0.5, 8);
const pink = new THREE.DirectionalLight('#ff8fcb', 1.8);
pink.position.set(-4, -2.5, -5);
rig.add(blue, fill, pink);
for (const light of [blue, fill, pink]) rig.add(light.target);

function updateRig() {
  rig.quaternion.multiplyQuaternions(camera.quaternion, cameraStart);
  scene.environmentRotation.setFromQuaternion(rig.quaternion);
}

// --- robot ---
const robot = createRobot();
robot.rotation.y = -0.32;
robot.position.x = -0.06;
scene.add(robot);

const { neck } = robot.userData;
// head turned a touch less than the body and sitting a little off-centre, as in the reference
neck.rotation.y = 0.08;
neck.position.x = 0.06;

// faint contact shadow so the robot reads as standing on the floor when it gets up
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

// floor: a pastel play mat on a pale floor that fades into the white background in
// the distance. Both are drawn unlit and underneath everything, with a shadow
// catcher on top of them.
scene.fog = new THREE.Fog('#ffffff', 14, 40);
const FLOOR_SIZE = 120;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: FLOOR_COLOR, toneMapped: false, depthWrite: false }),
);
floor.renderOrder = -2;
scene.add(floor);

const MAT_RADIUS = 3.9;
const MAT_MARGIN = 0.5;
const mat = new THREE.Mesh(
  new THREE.CircleGeometry(MAT_RADIUS + MAT_MARGIN, 128).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    map: makeMatTexture(MAT_RADIUS, MAT_MARGIN),
    toneMapped: false,
    depthWrite: false,
  }),
);
mat.renderOrder = -1;
scene.add(mat);

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

function resize() {
  const w = Math.min(CANVAS_WIDTH, window.innerWidth);
  const h = window.innerHeight;
  camera.aspect = w / h;
  // keep the robot and its toys in frame on narrow screens (phones can pinch out for the outer toys)
  const fit = THREE.MathUtils.clamp(1.55 / camera.aspect, 1, 2.2);
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
