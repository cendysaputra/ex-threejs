import * as THREE from 'three';
import { makeEarTexture, makeEyeTexture, makeGlowTexture, makeVisorTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Shape parameters (1 unit ≈ half the head width)
// ---------------------------------------------------------------------------

// Head shell: superellipsoid |x/(a·w)|^p + |y/b|^p + |z/(c·w)|^p = 1, where the width
// factor w(y) tapers the dome and lets the lower half bulge, like a soft egg.
const HEAD = { a: 1.0, b: 0.85, c: 0.92, p: 2.15, taper: 0.1 };
const NECK_Y = 0.69; // neck pivot above the ground
const HEAD_Y = 0.83; // head centre above the neck pivot

// Visor opening: superellipse on the front of the head, in head space
const VISOR = { cy: -0.08, hw: 0.76, hh: 0.62, n: 2.4 };

// Face features in visor space (u, v in [-1, 1])
const EYE = { u: 0.47, v: 0.08, hw: 0.18, hh: 0.285, n: 2.45, halo: 1.4 };
const SMILE = { x: 0, y: -0.155, r: 0.088, tube: 0.019 };

const TORSO_Z = 0.86; // torso depth squash

// Legs hang from hip pivots; `sit` is the hip angle while sitting, π/2 is standing.
const LEG = { x: 0.41, hipY: 0.2, offset: 0.12, sit: -0.1, back: -0.2, tip: 0.418, radius: 0.214 };
// The upper body (torso, arms, head) leans around this point, roughly the seat.
const SEAT = new THREE.Vector3(0, 0.12, -0.05);

// How far the hips must rise so the lowest point of the legs stays on the floor.
function legDrop(angle) {
  const s = Math.sin(angle);
  const reach = Math.max((LEG.back + LEG.offset) * s, (LEG.tip + LEG.offset) * s);
  return reach + LEG.radius * Math.cos(angle) - LEG.hipY;
}
export function hipLift(angle) {
  return Math.max(0, legDrop(angle) - legDrop(LEG.sit));
}
export const LEG_SIT = LEG.sit;
export const LEG_STAND = Math.PI / 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sgnPow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

function headWidth(y) {
  return 1 - HEAD.taper * THREE.MathUtils.clamp(y / HEAD.b, -1, 1);
}

function headZ(x, y) {
  const { a, b, c, p } = HEAD;
  const w = headWidth(y);
  const t = 1 - Math.abs(x / (a * w)) ** p - Math.abs(y / b) ** p;
  return t > 0 ? c * w * Math.pow(t, 1 / p) : 0;
}

function headX(y, z) {
  const { a, b, c, p } = HEAD;
  const w = headWidth(y);
  const t = 1 - Math.abs(y / b) ** p - Math.abs(z / (c * w)) ** p;
  return t > 0 ? a * w * Math.pow(t, 1 / p) : 0;
}

function headY(x, z) {
  const { a, b, c, p } = HEAD;
  // the width depends on y, so settle it with a few fixed-point steps
  let y = b * 0.8;
  for (let i = 0; i < 12; i++) {
    const w = headWidth(y);
    const t = 1 - Math.abs(x / (a * w)) ** p - Math.abs(z / (c * w)) ** p;
    y = t > 0 ? b * Math.pow(t, 1 / p) : 0;
  }
  return y;
}

function headGeometry() {
  const { a, b, c, p, taper } = HEAD;
  const geo = new THREE.SphereGeometry(1, 220, 160);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = Math.pow(Math.abs(v.x) ** p + Math.abs(v.y) ** p + Math.abs(v.z) ** p, -1 / p);
    const y = v.y * k * b;
    const w = headWidth(y);
    const x = v.x * k * a * w;
    const z = v.z * k * c * w;
    pos.setXYZ(i, x, y, z);
    // analytic normal (gradient of the implicit surface) keeps the seam invisible
    const X = x / (a * w);
    const Z = z / (c * w);
    n.set(
      sgnPow(X, p - 1) / (a * w),
      sgnPow(y / b, p - 1) / b + ((Math.abs(X) ** p + Math.abs(Z) ** p) * taper) / (b * w),
      sgnPow(Z, p - 1) / (c * w),
    );
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

export function plastic(color, extra = {}) {
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
    collar: plastic('#9c84dc'),
    chinPlate: plastic('#c3b3ee'),
    earRing: plastic('#c8b4f2'),
    arm: plastic('#a3c0f6'),
    hand: plastic('#8f84e8'),
    feet: plastic('#f6b8e4'),
    groove: plastic('#c3b4ee', { roughness: 0.5, clearcoat: 0.2 }),
    gasket: plastic('#9f8ad9', { roughness: 0.3, clearcoat: 1 }),
    antennaBall: plastic('#dabcf2'),
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
    gasket.push(glassPoint(u * 0.958, v * 0.958, new THREE.Vector3()));
  }
  const lip = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 480, 0.03, 20, true),
    mats.shell,
  );
  lip.castShadow = true;
  head.add(lip);
  head.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gasket, true), 480, 0.0075, 10, true),
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
      // mostly self-lit so the coloured key lights don't tint the glass
      color: new THREE.Color(0.6, 0.6, 0.6),
      map: visorTex,
      emissiveMap: visorTex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.8,
      roughness: 0.12,
      metalness: 0,
      ior: 2.2, // a stronger reflection than real glass, for the glossy toy look
      clearcoat: 1,
      clearcoatRoughness: 0.06,
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
    const a = THREE.MathUtils.degToRad(196 + (148 * i) / 40);
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
      [0.318, -0.1],
      [0.328, 0.0],
      [0.329, 0.058],
      [0.321, 0.088],
      [0.302, 0.105],
      [0.27, 0.112],
      [0.24, 0.11],
      [0.218, 0.1],
      [0.205, 0.084],
      [0.2, 0.06],
      [0.198, 0.0],
    ],
    48,
    96,
  ).rotateX(Math.PI / 2);
  const capGeo = diskGeometry(2, 24, 96, (u, v, out) =>
    out.set(u * 0.202, v * 0.202, 0.068 + 0.016 * (1 - u * u - v * v)),
  );
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, mats.earRing);
    ring.castShadow = true;
    ring.receiveShadow = true;
    const cap = new THREE.Mesh(capGeo, earCapMat);
    ear.add(ring, cap);
    const y = -0.06;
    const z = 0.08;
    const x = side * (headX(y, z) - 0.03);
    ear.position.set(x, y, z);
    ear.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(side, 0, 0.26).normalize(),
    );
    head.add(ear);
    return ear;
  });

  // antennae
  const antennae = [-1, 1].map((side) => {
    const x = side * 0.6;
    const z = 0.04;
    const base = new THREE.Vector3(x, headY(x, z), z);
    const pivot = new THREE.Group();
    pivot.position.copy(base);
    pivot.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(side * 0.5, 1, 0.02).normalize(),
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
      [0.525, 0.15],
      [0.55, 0.27],
      [0.545, 0.39],
      [0.53, 0.49],
      [0.505, 0.58],
      [0.465, 0.64],
      [0.36, 0.675],
      [0.0, 0.685],
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
        [0.0, 0.632],
        [0.38, 0.632],
        [0.42, 0.638],
        [0.436, 0.652],
        [0.438, 0.665],
        [0.428, 0.68],
        [0.4, 0.688],
        [0.3, 0.69],
        [0.0, 0.69],
      ],
      48,
      128,
    ),
    mats.collar,
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
    mats.chinPlate,
  );
  tab.position.copy(onTorso(0, 0.64, -0.045));
  tab.rotation.x = -0.32;
  tab.castShadow = true;
  body.add(tab);

  // chest grooves  \_  ▬  _/
  for (const side of [-1, 1]) {
    const pts = [
      [0.31, 0.525],
      [0.235, 0.455],
      [0.165, 0.448],
      [0.12, 0.455],
    ].map(([x, y]) => onTorso(side * x, y, 0.002));
    const groove = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 32, 0.0075, 8, false),
      mats.groove,
    );
    body.add(groove);
  }

  // glowing chest bar
  const barPos = onTorso(0, 0.467, 0.0);
  const bar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.02, 0.16, 8, 16).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.0, 1.0), toneMapped: false }),
  );
  bar.position.copy(barPos);
  bar.position.z -= 0.004;
  bar.rotation.x = -0.25;
  bar.scale.z = 0.6;
  body.add(bar);
  const barGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.06),
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
  // the arm widens towards the bottom like a mitten
  const mittenGeo = lathe(
    [
      [0.0, -0.475],
      [0.08, -0.47],
      [0.128, -0.447],
      [0.152, -0.4],
      [0.156, -0.31],
      [0.146, -0.2],
      [0.13, -0.1],
      [0.112, -0.03],
      [0.0, 0.0],
    ],
    48,
    64,
  );
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.54, 0.6, -0.02);
    arm.userData.side = side;
    arm.userData.rest = { x: -0.16, z: side * 0.42 };
    arm.rotation.set(arm.userData.rest.x, 0, arm.userData.rest.z);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 48, 32), mats.lavender);
    const limb = new THREE.Mesh(mittenGeo, mats.arm);
    limb.scale.z = 0.86;
    const fingers = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 24), mats.hand);
    fingers.position.set(-side * 0.04, -0.455, 0.07);
    fingers.scale.set(1, 0.8, 1);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), mats.hand);
    thumb.position.set(-side * 0.115, -0.405, 0.06);
    for (const m of [shoulder, limb, fingers, thumb]) {
      m.castShadow = true;
      m.receiveShadow = true;
      arm.add(m);
    }
    body.add(arm);
    return arm;
  });

  // stubby legs: each hangs from a hip pivot, pointing at the viewer while sitting and
  // swinging down underneath the body to stand
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
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * LEG.x, LEG.hipY, 0);
    hip.rotation.x = LEG.sit;
    const leg = new THREE.Mesh(legGeo, mats.feet);
    leg.position.set(0, -0.01, LEG.offset);
    leg.scale.set(0.88, 0.92, 1);
    leg.rotation.y = side * 0.06;
    leg.castShadow = true;
    leg.receiveShadow = true;
    hip.add(leg);
    return hip;
  });

  return { body, arms, legs, bar, barGlow };
}

// ---------------------------------------------------------------------------

export function createRobot() {
  const mats = makeMaterials();
  const robot = new THREE.Group();
  robot.name = 'robot';

  const { body, arms, legs, bar, barGlow } = buildBody(mats);

  // everything above the hips hangs off the seat pivot so it can lean as one piece
  const upper = new THREE.Group();
  upper.position.copy(SEAT);
  const upperInner = new THREE.Group();
  upperInner.position.copy(SEAT).negate();
  upper.add(upperInner);
  upperInner.add(body);
  robot.add(upper, ...legs);

  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  upperInner.add(neck);

  const { head, eyes, ears, antennae } = buildHead(mats);
  head.position.y = HEAD_Y;
  neck.add(head);

  robot.userData = { neckY: NECK_Y, upper, neck, head, eyes, ears, antennae, arms, legs, bar, barGlow };
  return robot;
}
