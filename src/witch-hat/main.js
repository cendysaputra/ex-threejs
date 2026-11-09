import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWitchHat } from './model.js';
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
renderer.shadowMap.type = THREE.PCFShadowMap;
mount.append(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);
scene.environmentIntensity = .38;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.9, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.8;
scene.add(new THREE.HemisphereLight('#eee8ff', '#685079', .4));
const key = new THREE.DirectionalLight('#fff7f0', 3.2);
key.position.set(-4.5, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024,1024);
Object.assign(key.shadow.camera,{left:-4,right:4,top:5,bottom:-3,near:1,far:20});
key.shadow.bias=-.0003;
key.shadow.normalBias=.025;
key.shadow.radius=5;
scene.add(key);
const rim = new THREE.DirectionalLight('#dbc1ff', 2.0);
rim.position.set(4, 4, -3);
scene.add(rim);
const fill = new THREE.DirectionalLight('#d7dbff', .7);
fill.position.set(4, 2, 6);
scene.add(fill);

const hat = createWitchHat();
scene.add(hat.root);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  camera.aspect = w / h;
  const mobile = w < 701;
  const distance = mobile ? Math.max(13, 6.9 / (w/h) / (2 * Math.tan(THREE.MathUtils.degToRad(43/2)))) : 11.8;
  camera.position.set(0, 3.25, distance);
  camera.fov = mobile ? 43 : 32;
  camera.setViewOffset(w, h, mobile ? 0 : -w * 0.13, mobile ? -h * 0.13 : 0, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  controls.update();
}
addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene,camera);
});
status.hidden=true;
