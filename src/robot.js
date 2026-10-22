import * as THREE from 'three';
import { makeEarTexture, makeEyeTexture, makeGlowTexture, makeVisorTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Shape parameters (1 unit ≈ half the head width)
// ---------------------------------------------------------------------------

// Head shell: superellipsoid |x/a|^p + |y/b|^p + |z/c|^p = 1
const HEAD = { a: 1.0, b: 0.87, c: 0.92, p: 2.15 };
const NECK_Y = 0.66; // neck pivot above the ground
const HEAD_Y = 0.83; // head centre above the neck pivot

// Visor opening: superellipse on the front of the head, in head space
const VISOR = { cy: -0.05, hw: 0.75, hh: 0.61, n: 2.55 };

// Face features in visor space (u, v in [-1, 1])
const EYE = { u: 0.47, v: 0.03, hw: 0.2, hh: 0.31, n: 3.2, halo: 1.6 };
const SMILE = { x: 0, y: -0.215, r: 0.07, tube: 0.0135 };

const TORSO_Z = 0.86; // torso depth squash

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sgnPow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

function headZ(x, y) {
  const { a, b, c, p } = HEAD;
  const t = 1 - Math.abs(x / a) ** p - Math.abs(y / b) ** p;
  return t > 0 ? c * Math.pow(t, 1 / p) : 0;
}

function headY(x, z) {
  const { a, b, c, p } = HEAD;
  const t = 1 - Math.abs(x / a) ** p - Math.abs(z / c) ** p;
  return t > 0 ? b * Math.pow(t, 1 / p) : 0;
}

function headGeometry() {
  const { a, b, c, p } = HEAD;
  const geo = new THREE.SphereGeometry(1, 220, 160);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = Math.pow(Math.abs(v.x) ** p + Math.abs(v.y) ** p + Math.abs(v.z) ** p, -1 / p);
    const x = v.x * k * a;
    const y = v.y * k * b;
    const z = v.z * k * c;
    pos.setXYZ(i, x, y, z);
    // analytic normal (gradient of the implicit surface) keeps the seam invisible
    n.set(sgnPow(x / a, p - 1) / a, sgnPow(y / b, p - 1) / b, sgnPow(z / c, p - 1) / c);
    if (n.lengthSq() < 1e-12) n.copy(v);
    n.normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

/**
 * Disk over a superellipse |u|^n + |v|^n <= 1, mapped through `point(u, v, out)`.
 * Faces point towards +z of the (u, v) plane; uv = (u, v) remapped to [0, 1].
 */
function diskGeometry(n, rings, segs, point) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const tmp = new THREE.Vector3();
  const push = (u, v) => {
    point(u, v, tmp);
    positions.push(tmp.x, tmp.y, tmp.z);
    uvs.push(u * 0.5 + 0.5, v * 0.5 + 0.5);
  };
  push(0, 0);
  for (let i = 1; i <= rings; i++) {
    const s = i / rings;
    for (let j = 0; j < segs; j++) {
      const t = (j / segs) * Math.PI * 2;
      push(s * sgnPow(Math.cos(t), 2 / n), s * sgnPow(Math.sin(t), 2 / n));
    }
  }
  for (let j = 0; j < segs; j++) indices.push(0, 1 + j, 1 + ((j + 1) % segs));
  for (let i = 1; i < rings; i++) {
    const r0 = 1 + (i - 1) * segs;
    const r1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      indices.push(r0 + j, r1 + j, r0 + j1, r0 + j1, r1 + j, r1 + j1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function visorS(u, v) {
  return Math.pow(Math.abs(u) ** VISOR.n + Math.abs(v) ** VISOR.n, 1 / VISOR.n);
}

// Glass surface: domed, sinking slightly below the shell towards its rim
function glassPoint(u, v, out) {
  const x = u * VISOR.hw;
  const y = VISOR.cy + v * VISOR.hh;
  const s = Math.min(1, visorS(u, v));
  return out.set(x, y, headZ(x, y) + 0.025 - 0.07 * s ** 3);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
function glassNormal(u, v, out) {
  const e = 1e-3;
  glassPoint(u + e, v, _a).sub(glassPoint(u - e, v, _b));
  const du = _a.clone();
  glassPoint(u, v + e, _a).sub(glassPoint(u, v - e, _b));
  return out.crossVectors(du, _a).normalize();
}

function onGlass(u, v, lift, out) {
  const n = glassNormal(u, v, new THREE.Vector3());
  return glassPoint(u, v, out).addScaledVector(n, lift);
}

function smoothProfile(points, count) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getSpacedPoints(count);
}

function lathe(points, count = 64, segs = 96) {
  return new THREE.LatheGeometry(smoothProfile(points, count), segs);
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function plastic(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0,
    specularIntensity: 0.45,
    clearcoat: 0.25,
    clearcoatRoughness: 0.32,
    ...extra,
  });
}

function makeMaterials() {
  return {
    shell: plastic('#ffffff'),
    lavender: plastic('#a690e4'),
    lilac: plastic('#d9cdf7'),
    earRing: plastic('#b9a8f2'),
    arm: plastic('#b4cbf7'),
    hand: plastic('#a597ec'),
    feet: plastic('#efc3ee'),
    groove: plastic('#c3b4ee', { roughness: 0.5, clearcoat: 0.2 }),
    gasket: plastic('#ffd6ec', { roughness: 0.25, clearcoat: 1 }),
    antennaBall: plastic('#e4cbf5'),
  };
}

/** Shell material that cuts the visor opening out of the front of the head. */
function headShellMaterial(base) {
  const mat = base.clone();
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        {
          vec2 q = abs(vec2(vHeadPos.x / ${VISOR.hw.toFixed(4)}, (vHeadPos.y - (${VISOR.cy.toFixed(4)})) / ${VISOR.hh.toFixed(4)}));
          float s = pow(pow(q.x, ${VISOR.n.toFixed(3)}) + pow(q.y, ${VISOR.n.toFixed(3)}), ${(1 / VISOR.n).toFixed(5)});
          if (vHeadPos.z > 0.0 && s < 1.0) discard;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'robot-head-shell';
  return mat;
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function buildHead(mats) {
  const head = new THREE.Group();
  head.name = 'head';

  const shell = new THREE.Mesh(headGeometry(), headShellMaterial(mats.shell));
  shell.castShadow = true;
  shell.receiveShadow = true;
  head.add(shell);

  // rounded lip around the visor opening
  const rim = [];
  const gasket = [];
  const N = 360;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const u = sgnPow(Math.cos(t), 2 / VISOR.n);
    const v = sgnPow(Math.sin(t), 2 / VISOR.n);
    const x = u * VISOR.hw;
    const y = VISOR.cy + v * VISOR.hh;
    rim.push(new THREE.Vector3(x, y, headZ(x, y) - 0.02));
    gasket.push(glassPoint(u * 0.955, v * 0.955, new THREE.Vector3()));
  }
  const lip = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 480, 0.042, 20, true),
    mats.shell,
  );
  lip.castShadow = true;
  head.add(lip);
  head.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gasket, true), 480, 0.015, 12, true),
      mats.gasket,
    ),
  );

  // glass
  const eyes = [-1, 1].map((side) => ({ u: side * EYE.u, v: EYE.v }));
  const smileUV = { u: SMILE.x / VISOR.hw, v: (SMILE.y - VISOR.cy) / VISOR.hh };
  const visorTex = makeVisorTexture({ eyes, smile: smileUV });
  const glass = new THREE.Mesh(
    diskGeometry(VISOR.n, 64, 256, glassPoint),
    new THREE.MeshPhysicalMaterial({
      map: visorTex,
      emissiveMap: visorTex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.5,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      specularIntensity: 0.6,
    }),
  );
  head.add(glass);

  // eyes
  const eyeTex = makeEyeTexture(EYE.n, 1 / EYE.halo);
  const eyeMat = new THREE.MeshBasicMaterial({
    map: eyeTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const eyeMeshes = eyes.map((e) => {
    const centre = onGlass(e.u, e.v, 0.006, new THREE.Vector3());
    const geo = diskGeometry(EYE.n, 24, 96, (a, b, out) =>
      onGlass(e.u + a * EYE.hw * EYE.halo, e.v + b * EYE.hh * EYE.halo, 0.006, out).sub(centre),
    );
    const mesh = new THREE.Mesh(geo, eyeMat);
    mesh.position.copy(centre);
    mesh.renderOrder = 2;
    head.add(mesh);
    return mesh;
  });

  // smile
  const smilePts = [];
  for (let i = 0; i <= 40; i++) {
    const a = THREE.MathUtils.degToRad(192 + (156 * i) / 40);
    const x = SMILE.x + SMILE.r * Math.cos(a);
    const y = SMILE.y + SMILE.r + SMILE.r * Math.sin(a);
    smilePts.push(onGlass(x / VISOR.hw, (y - VISOR.cy) / VISOR.hh, 0.008, new THREE.Vector3()));
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.88), toneMapped: false });
  head.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 64, SMILE.tube, 10, false),
      glowMat,
    ),
  );
  for (const p of [smilePts[0], smilePts[smilePts.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(SMILE.tube, 12, 8), glowMat);
    cap.position.copy(p);
    head.add(cap);
  }

  // ears
  const earTex = makeEarTexture();
  const earCapMat = new THREE.MeshPhysicalMaterial({
    map: earTex,
    emissiveMap: earTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.7,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const ringGeo = lathe(
    [
      [0.34, -0.1],
      [0.352, 0.0],
      [0.348, 0.07],
      [0.334, 0.112],
      [0.306, 0.138],
      [0.27, 0.148],
      [0.234, 0.141],
      [0.21, 0.122],
      [0.2, 0.095],
      [0.196, 0.06],
      [0.195, 0.0],
    ],
    48,
    96,
  ).rotateX(Math.PI / 2);
  const capGeo = diskGeometry(2, 24, 96, (u, v, out) =>
    out.set(u * 0.2, v * 0.2, 0.085 + 0.022 * (1 - u * u - v * v)),
  );
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, mats.earRing);
    ring.castShadow = true;
    ring.receiveShadow = true;
    const cap = new THREE.Mesh(capGeo, earCapMat);
    ear.add(ring, cap);
    const y = -0.06;
    const z = -0.02;
    const x =
      side *
      (HEAD.a * Math.pow(1 - Math.abs(y / HEAD.b) ** HEAD.p - Math.abs(z / HEAD.c) ** HEAD.p, 1 / HEAD.p) -
        0.035);
    ear.position.set(x, y, z);
    ear.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(side, 0, 0.28).normalize(),
    );
    head.add(ear);
    return ear;
  });

  // antennae
  const antennae = [-1, 1].map((side) => {
    const x = side * 0.63;
    const z = -0.06;
    const base = new THREE.Vector3(x, headY(x, z), z);
    const pivot = new THREE.Group();
    pivot.position.copy(base);
    pivot.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(side * 0.42, 1, -0.04).normalize(),
    );
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.05, 32), mats.shell);
    socket.position.y = 0.0;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.2, 24), mats.lilac);
    stalk.position.y = 0.1;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.122, 48, 32), mats.antennaBall);
    ball.position.y = 0.225;
    // inner group so the idle wobble doesn't fight the mounting angle
    const wobble = new THREE.Group();
    pivot.add(wobble);
    for (const m of [socket, stalk, ball]) {
      m.castShadow = true;
      wobble.add(m);
    }
    head.add(pivot);
    return wobble;
  });

  return { head, eyes: eyeMeshes, ears, antennae };
}

function torsoRadiusFn(profile) {
  return (y) => {
    for (let i = 1; i < profile.length; i++) {
      const p0 = profile[i - 1];
      const p1 = profile[i];
      if ((y - p0.y) * (y - p1.y) <= 0 && p0.y !== p1.y) {
        return p0.x + ((p1.x - p0.x) * (y - p0.y)) / (p1.y - p0.y);
      }
    }
    return 0;
  };
}

function buildBody(mats) {
  const body = new THREE.Group();
  body.name = 'body';

  // torso: a soft, bottom-heavy bean
  const profile = smoothProfile(
    [
      [0.0, 0.03],
      [0.3, 0.035],
      [0.45, 0.07],
      [0.52, 0.15],
      [0.545, 0.26],
      [0.54, 0.37],
      [0.52, 0.47],
      [0.48, 0.55],
      [0.43, 0.61],
      [0.3, 0.645],
      [0.0, 0.65],
    ],
    80,
  );
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), mats.shell);
  torso.scale.z = TORSO_Z;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const radiusAt = torsoRadiusFn(profile);
  const onTorso = (x, y, lift = 0) => {
    const r = radiusAt(y) + lift;
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * TORSO_Z);
  };

  // lavender collar under the head
  const collar = new THREE.Mesh(
    lathe(
      [
        [0.0, 0.605],
        [0.37, 0.605],
        [0.41, 0.611],
        [0.425, 0.624],
        [0.427, 0.636],
        [0.417, 0.65],
        [0.39, 0.658],
        [0.3, 0.66],
        [0.0, 0.66],
      ],
      48,
      128,
    ),
    mats.lavender,
  );
  collar.scale.z = TORSO_Z;
  collar.castShadow = true;
  collar.receiveShadow = true;
  body.add(collar);

  // little chin plate hanging from the collar
  const tabShape = new THREE.Shape();
  tabShape.moveTo(-0.16, 0);
  tabShape.lineTo(0.16, 0);
  tabShape.lineTo(0.11, -0.065);
  tabShape.lineTo(-0.11, -0.065);
  tabShape.closePath();
  const tab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tabShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 4,
      curveSegments: 4,
    }),
    mats.lilac,
  );
  tab.position.copy(onTorso(0, 0.595, -0.045));
  tab.rotation.x = -0.32;
  tab.castShadow = true;
  body.add(tab);

  // chest grooves  \_  ▬  _/
  for (const side of [-1, 1]) {
    const pts = [
      [0.3, 0.495],
      [0.225, 0.425],
      [0.16, 0.418],
      [0.115, 0.425],
    ].map(([x, y]) => onTorso(side * x, y, 0.002));
    const groove = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 32, 0.0075, 8, false),
      mats.groove,
    );
    body.add(groove);
  }

  // glowing chest bar
  const barPos = onTorso(0, 0.437, 0.0);
  const bar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.02, 0.16, 8, 16).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.0, 1.0), toneMapped: false }),
  );
  bar.position.copy(barPos);
  bar.position.z -= 0.004;
  bar.rotation.x = -0.25;
  bar.scale.z = 0.6;
  body.add(bar);
  const barGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.07),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      color: new THREE.Color(0.45, 0.95, 1.0),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  barGlow.position.copy(barPos).add(new THREE.Vector3(0, 0, 0.012));
  barGlow.rotation.x = -0.25;
  body.add(barGlow);

  // arms: lavender shoulder cap, soft blue arm angled out and forward, lilac hand nubs.
  // Each arm is a pivot at the shoulder; `rest` holds the pose the animation starts from.
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.5, 0.58, -0.02);
    arm.userData.side = side;
    arm.userData.rest = { x: -0.14, z: side * 0.42 };
    arm.rotation.set(arm.userData.rest.x, 0, arm.userData.rest.z);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.122, 48, 32), mats.lavender);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.138, 0.19, 12, 32), mats.arm);
    limb.position.y = -0.21;
    limb.scale.z = 0.92;
    const fingers = new THREE.Mesh(new THREE.SphereGeometry(0.068, 32, 24), mats.hand);
    fingers.position.set(-side * 0.02, -0.39, 0.05);
    fingers.scale.set(1, 0.85, 1);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), mats.hand);
    thumb.position.set(-side * 0.085, -0.35, 0.075);
    for (const m of [shoulder, limb, fingers, thumb]) {
      m.castShadow = true;
      m.receiveShadow = true;
      arm.add(m);
    }
    body.add(arm);
    return arm;
  });

  // stubby legs pointing at the viewer
  const legGeo = lathe(
    [
      [0.0, -0.2],
      [0.2, -0.2],
      [0.215, 0.1],
      [0.222, 0.3],
      [0.218, 0.36],
      [0.2, 0.395],
      [0.165, 0.412],
      [0.0, 0.418],
    ],
    64,
    96,
  ).rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, mats.feet);
    leg.position.set(side * 0.42, 0.19, 0.12);
    leg.scale.set(0.9, 0.88, 1);
    leg.rotation.set(-0.1, side * 0.06, 0);
    leg.castShadow = true;
    leg.receiveShadow = true;
    body.add(leg);
  }

  return { body, arms, bar, barGlow };
}

// ---------------------------------------------------------------------------

export function createRobot() {
  const mats = makeMaterials();
  const robot = new THREE.Group();
  robot.name = 'robot';

  const { body, arms, bar, barGlow } = buildBody(mats);
  robot.add(body);

  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  robot.add(neck);

  const { head, eyes, ears, antennae } = buildHead(mats);
  head.position.y = HEAD_Y;
  neck.add(head);

  robot.userData = { neckY: NECK_Y, neck, head, eyes, ears, antennae, arms, bar, barGlow };
  return robot;
}
