import * as THREE from 'three';
import { makeVisorGlassTexture, makeVisorGlowTexture } from './textures.js';

// ---------------------------------------------------------------------------
// White-and-pink robot: glossy white shell, dark glass visor with glowing
// "^ ^" eyes, pink headphone ears with a neon ring, pink cap stripe, grey
// joints and mitten hands, chunky boots with pink toes. Built standing, facing
// +z, feet on y = 0. 1 unit ≈ the head's half width.
// ---------------------------------------------------------------------------

// Head shell: superellipsoid |x/a|^p + |y/b|^p + |z/c|^p = 1
const HEAD = { a: 0.89, b: 0.72, c: 0.8, p: 2.6 };
const NECK_Y = 1.38; // neck pivot above the ground
const HEAD_Y = 0.77; // head centre above the neck pivot

// Visor opening on the front of the head, in head space
const VISOR = { cy: -0.05, hw: 0.7, hh: 0.5, n: 3.4 };

// Face: eye arcs in head units around visor-space centres, blush marks in visor space
const EYE = { u: 0.45, v: -0.1, r: 0.165, from: 15, to: 165, tube: 0.036 };
const BLUSH = { u: 0.66, v: -0.42, len: 0.06, gap: 0.034, tube: 0.011 };

// Torso: lathe profile (radius, height), squashed front to back
const TORSO_Z = 0.86;
const TORSO_PROFILE = [
  [0.0, 0.6],
  [0.2, 0.61],
  [0.32, 0.67],
  [0.38, 0.77],
  [0.395, 0.9],
  [0.386, 1.03],
  [0.36, 1.14],
  [0.315, 1.24],
  [0.24, 1.32],
  [0.1, 1.37],
  [0.0, 1.375],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sgnPow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

function headZ(x, y) {
  const { a, b, c, p } = HEAD;
  const t = 1 - Math.abs(x / a) ** p - Math.abs(y / b) ** p;
  return t > 0 ? c * Math.pow(t, 1 / p) : 0;
}

function headX(y, z) {
  const { a, b, c, p } = HEAD;
  const t = 1 - Math.abs(y / b) ** p - Math.abs(z / c) ** p;
  return t > 0 ? a * Math.pow(t, 1 / p) : 0;
}

function headY(x, z) {
  const { a, b, c, p } = HEAD;
  const t = 1 - Math.abs(x / a) ** p - Math.abs(z / c) ** p;
  return t > 0 ? b * Math.pow(t, 1 / p) : 0;
}

function headNormal(x, y, z, out) {
  const { a, b, c, p } = HEAD;
  return out.set(sgnPow(x / a, p - 1) / a, sgnPow(y / b, p - 1) / b, sgnPow(z / c, p - 1) / c).normalize();
}

function headGeometry() {
  const { a, b, c, p } = HEAD;
  const geo = new THREE.SphereGeometry(1, 200, 150);
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
    // analytic normal keeps the sphere seam invisible
    headNormal(x, y, z, n);
    if (!Number.isFinite(n.x)) n.copy(v);
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

/**
 * A raised pad: top surface lifted `height` along the surface normal, plus a
 * skirt down to the surface, so the panel shows its thickness at the edge.
 * `point(u, v, lift, out)` maps the superellipse disk onto the underlying surface.
 */
function padGeometry(n, height, point) {
  const top = diskGeometry(n, 20, 128, (u, v, out) => point(u, v, height, out));
  const segs = 128;
  const positions = [];
  const indices = [];
  const tmp = new THREE.Vector3();
  for (let j = 0; j <= segs; j++) {
    const t = (j / segs) * Math.PI * 2;
    const u = sgnPow(Math.cos(t), 2 / n);
    const v = sgnPow(Math.sin(t), 2 / n);
    // rounded edge: a few steps from the top down to the surface
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      const shrink = 1 - (1 - Math.cos(a)) * 0.02;
      point(u * shrink, v * shrink, height * Math.cos(a), tmp);
      positions.push(tmp.x, tmp.y, tmp.z);
    }
  }
  for (let j = 0; j < segs; j++) {
    for (let k = 0; k < 4; k++) {
      const a = j * 5 + k;
      const b = (j + 1) * 5 + k;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  skirt.setIndex(indices);
  skirt.computeVertexNormals();
  return [top, skirt];
}

function smoothProfile(points, count) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getSpacedPoints(count);
}

function lathe(points, count = 64, segs = 96) {
  return new THREE.LatheGeometry(smoothProfile(points, count), segs);
}

function visorS(u, v) {
  return Math.pow(Math.abs(u) ** VISOR.n + Math.abs(v) ** VISOR.n, 1 / VISOR.n);
}

// Glass: gently domed, sinking below the shell towards its rim
function glassPoint(u, v, out) {
  const x = u * VISOR.hw;
  const y = VISOR.cy + v * VISOR.hh;
  const s = Math.min(1, visorS(u, v));
  return out.set(x, y, headZ(x, y) + 0.012 - 0.05 * s ** 3);
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

function tube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), radius, 10, closed),
    material,
  );
}

function roundCaps(points, radius, material, parent) {
  for (const p of [points[0], points[points.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
    cap.position.copy(p);
    parent.add(cap);
  }
}

function shadowed(...meshes) {
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Satin toy plastic, shared with the toys around the robot. */
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
    // glossy white shell
    white: plastic('#f6f6f8', {
      roughness: 0.3,
      specularIntensity: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
    }),
    pink: plastic('#f3c3d4', { roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    grey: plastic('#8b8b92', { roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    bezel: plastic('#dcdce2', { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
    eyeGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.82, 1.0, 1.0), toneMapped: false }),
    blushGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.97, 1.0), toneMapped: false }),
    pinkNeon: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.96), toneMapped: false }),
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
  mat.customProgramCacheKey = () => 'robot2-head-shell';
  return mat;
}

/** White plastic that turns pink below a slanted line: the boots' toe caps. */
function bootMaterial(white, pink) {
  const mat = white.clone();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.capColor = { value: pink.color };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBootPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBootPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBootPos;\nuniform vec3 capColor;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `float capLine = 0.15 + 0.1 * clamp(vBootPos.z / 0.33, -1.0, 1.0);
        float cap = 1.0 - smoothstep(capLine - 0.004, capLine + 0.004, vBootPos.y);
        vec4 diffuseColor = vec4( mix( diffuse, capColor, cap ), opacity );`,
      );
  };
  mat.customProgramCacheKey = () => 'robot2-boot';
  return mat;
}

// ---------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------

function buildHead(mats) {
  const head = new THREE.Group();
  head.name = 'head';

  const shell = new THREE.Mesh(headGeometry(), headShellMaterial(mats.white));
  shadowed(shell);
  head.add(shell);

  // visor rim (rounded shell lip) and a thin light grey bezel against the glass
  const rim = [];
  const bezel = [];
  const N = 320;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const u = sgnPow(Math.cos(t), 2 / VISOR.n);
    const v = sgnPow(Math.sin(t), 2 / VISOR.n);
    const x = u * VISOR.hw;
    const y = VISOR.cy + v * VISOR.hh;
    rim.push(new THREE.Vector3(x, y, headZ(x, y) - 0.016));
    bezel.push(glassPoint(u * 0.962, v * 0.962, new THREE.Vector3()));
  }
  const lip = tube(rim, 0.028, mats.white, true);
  shadowed(lip);
  head.add(lip, tube(bezel, 0.012, mats.bezel, true));

  // dark smoky glass, with the eyes' glow painted onto it
  const glowTex = makeVisorGlowTexture({ visor: VISOR, eye: EYE, blush: BLUSH });
  const glass = new THREE.Mesh(
    diskGeometry(VISOR.n, 64, 256, glassPoint),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: makeVisorGlassTexture(),
      roughness: 0.08,
      metalness: 0,
      ior: 1.8,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: glowTex,
      emissiveIntensity: 1,
    }),
  );
  head.add(glass);

  // happy closed eyes: two glowing arcs
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Group();
    const cx = side * EYE.u * VISOR.hw;
    const cy = VISOR.cy + EYE.v * VISOR.hh;
    const centre = onGlass(EYE.u * side, EYE.v, 0, new THREE.Vector3());
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = THREE.MathUtils.degToRad(EYE.from + ((EYE.to - EYE.from) * i) / 40);
      const x = cx + EYE.r * Math.cos(a);
      const y = cy + EYE.r * (Math.sin(a) - 0.55);
      pts.push(onGlass(x / VISOR.hw, (y - VISOR.cy) / VISOR.hh, 0.012, new THREE.Vector3()).sub(centre));
    }
    eye.add(tube(pts, EYE.tube, mats.eyeGlow));
    roundCaps(pts, EYE.tube, mats.eyeGlow, eye);
    eye.position.copy(centre);
    head.add(eye);
    return eye;
  });

  // "///" blush marks under the outer corners of the eyes
  for (const side of [-1, 1]) {
    for (let k = -1; k <= 1; k++) {
      const cu = side * BLUSH.u + (k * BLUSH.gap) / VISOR.hw;
      const cv = BLUSH.v;
      const dx = (BLUSH.len * 0.45) / VISOR.hw;
      const dy = (BLUSH.len * 0.9) / VISOR.hh / 2;
      const pts = [
        onGlass(cu - dx / 2, cv - dy, 0.01, new THREE.Vector3()),
        onGlass(cu + dx / 2, cv + dy, 0.01, new THREE.Vector3()),
      ];
      head.add(tube(pts, BLUSH.tube, mats.blushGlow));
      roundCaps(pts, BLUSH.tube, mats.blushGlow, head);
    }
  }

  // raised pink stripe over the top of the head, starting just above the visor
  const onCrown = (u, v, lift, out) => {
    const x = u * 0.31;
    const z = 0.28 - v * 0.24;
    const y = headY(x, z);
    const n = headNormal(x, y, z, new THREE.Vector3());
    return out.set(x, y, z).addScaledVector(n, lift);
  };
  for (const geo of padGeometry(4.5, 0.03, onCrown)) {
    const stripe = new THREE.Mesh(geo, mats.pink);
    shadowed(stripe);
    head.add(stripe);
  }

  // seam running over the head from ear to ear
  const seam = [];
  const seamZ = 0.08;
  const k = Math.pow(1 - Math.abs(seamZ / HEAD.c) ** HEAD.p, 1 / HEAD.p);
  for (let i = 0; i <= 120; i++) {
    const t = Math.PI * (0.12 + (0.76 * i) / 120);
    const cx = Math.cos(t);
    const cy = Math.sin(t);
    const r = k * Math.pow(Math.abs(cx / HEAD.a) ** HEAD.p + Math.abs(cy / HEAD.b) ** HEAD.p, -1 / HEAD.p);
    seam.push(new THREE.Vector3(cx * r * 1.002, cy * r * 1.002, seamZ));
  }
  head.add(tube(seam, 0.004, mats.bezel));

  // headphone ears: pink cup, neon ring, pink centre
  const cupGeo = lathe(
    [
      [0.3, -0.12],
      [0.322, 0.0],
      [0.328, 0.12],
      [0.32, 0.165],
      [0.3, 0.192],
      [0.268, 0.204],
      [0.23, 0.205],
      [0.0, 0.205],
    ],
    40,
    96,
  ).rotateX(Math.PI / 2);
  const capGeo = lathe(
    [
      [0.0, 0.238],
      [0.1, 0.234],
      [0.18, 0.222],
      [0.212, 0.21],
      [0.218, 0.196],
    ],
    24,
    96,
  ).rotateX(Math.PI / 2);
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    const cup = new THREE.Mesh(cupGeo, mats.pink);
    shadowed(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.242, 0.018, 16, 96), mats.pinkNeon);
    ring.position.z = 0.206;
    const inner = new THREE.Mesh(capGeo, mats.pink);
    shadowed(inner);
    ear.add(cup, ring, inner);
    const y = -0.08;
    const z = -0.04;
    ear.position.set(side * (headX(y, z) - 0.05), y, z);
    ear.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(side, 0, 0.22).normalize(),
    );
    head.add(ear);
    return ear;
  });

  return { head, eyes, ears };
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function buildArm(mats, side, upperLength) {
  const arm = new THREE.Group();
  arm.position.set(side * 0.37, 1.2, -0.01);
  arm.userData.side = side;

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.115, 40, 28), mats.grey);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, upperLength - 0.06, 32), mats.grey);
  upper.position.y = -(upperLength - 0.06) / 2 - 0.02;

  const elbow = new THREE.Group();
  elbow.position.y = -upperLength;
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 20), mats.grey);
  const sleeve = new THREE.Mesh(
    lathe(
      [
        [0.0, -0.44],
        [0.1, -0.435],
        [0.15, -0.41],
        [0.172, -0.35],
        [0.172, -0.22],
        [0.158, -0.11],
        [0.132, -0.03],
        [0.095, 0.0],
        [0.0, 0.005],
      ],
      48,
      64,
    ),
    mats.white,
  );
  sleeve.scale.z = 0.92;
  const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mats.pink);
  patch.scale.set(0.03, 0.1, 0.08);
  patch.position.set(side * 0.158, -0.25, 0.0);

  // grey mitten hand with a thumb
  const hand = new THREE.Group();
  hand.position.y = -0.48;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 40, 28), mats.grey);
  palm.scale.set(1.0, 1.2, 0.75);
  palm.position.y = -0.04;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.07, 8, 16), mats.grey);
  thumb.position.set(-side * 0.09, -0.01, 0.03);
  thumb.rotation.z = side * 0.55;
  hand.add(palm, thumb);

  elbow.add(joint, sleeve, patch, hand);
  arm.add(shoulder, upper, elbow);
  shadowed(shoulder, upper, joint, sleeve, patch, palm, thumb);
  return { arm, elbow, hand };
}

function buildBody(mats) {
  const body = new THREE.Group();
  body.name = 'body';

  const profile = smoothProfile(TORSO_PROFILE, 80);
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), mats.white);
  torso.scale.z = TORSO_Z;
  shadowed(torso);
  body.add(torso);

  const radiusAt = (y) => {
    for (let i = 1; i < profile.length; i++) {
      const p0 = profile[i - 1];
      const p1 = profile[i];
      if ((y - p0.y) * (y - p1.y) <= 0 && p0.y !== p1.y)
        return p0.x + ((p1.x - p0.x) * (y - p0.y)) / (p1.y - p0.y);
    }
    return 0;
  };
  // point on the torso at angle `a` from the front (towards +x) and height y
  const onTorso = (a, y, lift = 0) => {
    const r = radiusAt(y) + lift;
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * TORSO_Z);
  };

  // belly seam
  const seam = [];
  for (let i = 0; i < 160; i++) seam.push(onTorso((i / 160) * Math.PI * 2, 0.76, 0.002));
  body.add(tube(seam, 0.005, mats.bezel, true));

  // pink panel on the lower left of the belly
  const panel = new THREE.Mesh(
    diskGeometry(4, 16, 96, (u, v, out) => out.copy(onTorso(1.0 + u * 0.42, 0.71 + v * 0.07, 0.006))),
    mats.pink,
  );
  shadowed(panel);
  body.add(panel);

  // glowing pink slot on the chest
  const slotY = 1.17;
  const hw = 0.13;
  const hh = 0.032;
  const onChest = (x, y, lift) => {
    const r = radiusAt(y);
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * TORSO_Z + lift);
  };
  const slot = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = Math.sign(Math.cos(t)) * (hw - hh) + Math.cos(t) * hh;
    slot.push(onChest(x, slotY + Math.sin(t) * hh, 0.004));
  }
  body.add(tube(slot, 0.011, mats.pinkNeon, true));
  const slotFill = new THREE.Mesh(
    diskGeometry(5, 8, 64, (u, v, out) =>
      out.copy(onChest(u * (hw - 0.012), slotY + v * (hh - 0.012), 0.002)),
    ),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.93, 0.97), toneMapped: false }),
  );
  body.add(slotFill);

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 40), mats.grey);
  neck.position.y = 1.39;
  shadowed(neck);
  body.add(neck);

  // hips and boots
  const bootGeo = lathe(
    [
      [0.0, 0.0],
      [0.21, 0.0],
      [0.275, 0.018],
      [0.305, 0.065],
      [0.306, 0.125],
      [0.284, 0.24],
      [0.255, 0.36],
      [0.222, 0.46],
      [0.17, 0.53],
      [0.09, 0.56],
      [0.0, 0.565],
    ],
    64,
    96,
  );
  // push the toe forward near the ground, like a shoe
  {
    const pos = bootGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > 0) pos.setZ(i, z * (1 + 0.42 * Math.pow(1 - Math.min(1, y / 0.5), 1.6)));
    }
    bootGeo.computeVertexNormals();
  }
  const boot = bootMaterial(mats.white, mats.pink);
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.31, 0, 0);
    leg.rotation.y = side * 0.26;
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 40, 28), mats.grey);
    hip.position.set(-side * 0.08, 0.6, -0.01);
    const shoe = new THREE.Mesh(bootGeo, boot);
    shoe.scale.z = 1.1;
    shoe.position.z = 0.03;
    shadowed(hip, shoe);
    leg.add(hip, shoe);
    body.add(leg);
    return leg;
  });

  // the raised (left) arm shows more of its grey upper arm than the hanging one
  const right = buildArm(mats, -1, 0.16);
  const left = buildArm(mats, 1, 0.3);
  body.add(right.arm, left.arm);

  return { body, legs, arms: { right, left }, slot: slotFill };
}

// ---------------------------------------------------------------------------

export function createRobot() {
  const mats = makeMaterials();
  const robot = new THREE.Group();
  robot.name = 'robot';

  const { body, legs, arms, slot } = buildBody(mats);
  robot.add(body);

  const neck = new THREE.Group();
  neck.position.y = NECK_Y;
  body.add(neck);

  const { head, eyes, ears } = buildHead(mats);
  head.position.y = HEAD_Y;
  neck.add(head);

  robot.userData = {
    neckY: NECK_Y,
    body,
    neck,
    head,
    eyes,
    ears,
    legs,
    arms,
    glow: { slot, neon: mats.pinkNeon },
  };
  return robot;
}
