import * as THREE from 'three';
import { createIrisMaterial } from './iris.js';
import { animeMaterial, inkOutline } from './anime-material.js';
import { brimNormal, brimOnSurface, createBrimGeometry } from './brim.js';

const TAU = Math.PI * 2;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

function surfaceGeometry(rows, columns, sample, colorAt) {
  const positions = [],
    colors = [],
    uv = [],
    indices = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= columns; j++) {
      const u = i / rows,
        w = j / columns;
      positions.push(...sample(u, w).toArray());
      uv.push(w, u);
      if (colorAt) colors.push(...colorAt(u, w).toArray());
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j,
          b = a + columns + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorAt) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function tube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(32, points.length * 4), radius, 6, closed),
    material,
  );
}

function outward(geometry) {
  const index = geometry.index.array;
  for (let i = 0; i < index.length; i += 3) [index[i], index[i + 1]] = [index[i + 1], index[i]];
  geometry.computeVertexNormals();
  return geometry;
}

function star(size, material) {
  const shape = new THREE.Shape();
  shape.moveTo(0, size);
  shape.quadraticCurveTo(size * 0.2, size * 0.16, size * 0.55, 0);
  shape.quadraticCurveTo(size * 0.15, -size * 0.15, 0, -size);
  shape.quadraticCurveTo(-size * 0.15, -size * 0.15, -size * 0.55, 0);
  shape.quadraticCurveTo(-size * 0.2, size * 0.16, 0, size);
  return new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.012,
      bevelSegments: 3,
      steps: 1,
    }),
    material,
  );
}

function createEye(gold, cloth, surfaceZ) {
  const root = new THREE.Group();
  root.position.set(-0.12, 1.68, 0.9);
  const iris = createIrisMaterial();
  const width = 0.82;
  const arch = (u) => Math.pow(Math.max(0, Math.sin(Math.PI * u)), 1.25);
  function onCloth(x, y, lift = 0.018) {
    return v(x, y, surfaceZ(x - 0.12, y + 1.68) - 0.9 + lift);
  }
  function almond(u, upper, open) {
    const x = (2 * u - 1) * width;
    return onCloth(x, -0.1 * x + (upper ? 0.25 : -0.2) * arch(u) * open);
  }
  const parts = [];
  function addPart(rows, columns, material, sample) {
    const geo = surfaceGeometry(rows, columns, (a, u) => sample(a, u, 1));
    const closed = surfaceGeometry(rows, columns, (a, u) => sample(a, u, 0.015));
    geo.morphAttributes.position = [closed.attributes.position.clone()];
    geo.morphAttributes.normal = [closed.attributes.normal.clone()];
    closed.dispose();
    const mesh = new THREE.Mesh(geo, material);
    parts.push(mesh);
    root.add(mesh);
    return mesh;
  }
  const lens = addPart(16, 80, iris.material, (a, u, open) => {
    const p = almond(u, false, open).lerp(almond(u, true, open), a);
    p.z += 0.04 * Math.sin(a * Math.PI) * arch(u) * open - 0.013;
    return p;
  });
  for (const upper of [true, false]) {
    const sign = upper ? 1 : -1;
    // Broad cloth rolls merge back into the crown. Their outer edge stays fixed
    // while the aperture closes, so blinking folds the lids over the iris.
    addPart(12, 80, cloth, (a, u, open) => {
      const inner = almond(u, upper, open);
      const outer = almond(u, upper, 1);
      outer.y += sign * (upper ? 0.23 : 0.15) * arch(u);
      outer.z = surfaceZ(outer.x - 0.12, outer.y + 1.68) - 0.9 + 0.002;
      const p = inner.lerp(outer, a);
      p.z += 0.035 * Math.sin(Math.PI * a) * arch(u);
      return p;
    });
    // Gold is a tapered embroidered ribbon, not a constant-radius pipe.
    addPart(4, 80, gold, (a, u, open) => {
      const p = almond(u, upper, open);
      const taper = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.7);
      const ribbon = (upper ? 0.044 : 0.058) * taper;
      p.y += sign * ribbon * a;
      p.z += 0.008 + 0.009 * Math.sin(Math.PI * a) * taper;
      return p;
    });
  }
  return {
    root,
    setOpen(open) {
      for (const mesh of parts) mesh.morphTargetInfluences[0] = 1 - THREE.MathUtils.clamp(open, 0, 1);
    },
    look: iris.look,
    get openness() {
      return 1 - lens.morphTargetInfluences[0];
    },
  };
}

export function createWitchHat() {
  const root = new THREE.Group();
  const cloth = animeMaterial();
  const coloredCloth = cloth;
  const gold = animeMaterial('gold');
  const brightGold = gold;
  const base = new THREE.Color('#ffffff');
  const clothColor = (u, a) => {
    const theta = a * TAU;
    const fold = Math.sin(theta * 5 + u * 7) * 0.5 + Math.sin(theta * 8 - u * 8) * 0.15;
    const shade = 0.96 + fold * 0.035;
    return base.clone().multiplyScalar(shade);
  };
  const brim = new THREE.Mesh(createBrimGeometry(), coloredCloth);
  brim.receiveShadow = true;
  root.add(brim);

  const edgePoints = Array.from({ length: 145 }, (_, i) => brimOnSurface(1, (i / 144) * TAU, 0));
  root.add(tube(edgePoints, 0.025, gold, true));
  const innerStitch = Array.from({ length: 145 }, (_, i) => brimOnSurface(0.977, (i / 144) * TAU));
  root.add(tube(innerStitch, 0.008, brightGold, true));
  // Small scalloped embroidery follows the actual waving brim surface.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.16;
    const points = [
      [-0.18, 0.985],
      [-0.08, 0.91],
      [0, 0.925],
      [0.08, 0.91],
      [0.18, 0.985],
    ].map(([offset, t]) => brimOnSurface(t, a + offset));
    root.add(tube(points, 0.016, gold));
    const motif = star(0.075, brightGold);
    motif.position.copy(brimOnSurface(0.95, a));
    motif.quaternion.setFromUnitVectors(v(0, 0, 1), brimNormal(0.95, a));
    root.add(motif);
  }

  // Loft between designed silhouette boundaries. A circular swept tube made
  // the hanging tip look like a hose; the asymmetric sections form folded cloth.
  const left = new THREE.CatmullRomCurve3(
    [
      v(-1.23, 0.82, 0),
      v(-1.1, 1.45, 0),
      v(-0.84, 2.2, 0),
      v(-0.35, 3.05, 0),
      v(0.5, 3.95, 0),
      v(0.74, 3.49, 0),
      v(1.06, 3.13, 0),
      v(1.67, 2.75, 0),
      v(2.27, 2.36, 0),
      v(2.18, 1.91, 0),
    ],
    false,
    'catmullrom',
    0.5,
  );
  const right = new THREE.CatmullRomCurve3(
    [
      v(1.23, 0.82, 0),
      v(1.03, 1.45, 0),
      v(0.94, 2.2, 0),
      v(1.06, 2.9, 0),
      v(1.48, 3.58, 0),
      v(1.90, 3.15, 0),
      v(2.49, 2.91, 0),
      v(2.63, 2.56, 0),
      v(2.48, 2.19, 0),
      v(2.18, 1.91, 0),
    ],
    false,
    'catmullrom',
    0.5,
  );
  const depths = new THREE.SplineCurve(
    [1.08, 0.92, 0.83, 0.67, 0.36, 0.32, 0.25, 0.17, 0.09, 0.002].map((r, i) => new THREE.Vector2(i / 9, r)),
  );
  const creases = [
    [0.08, 0.27, 2.65, 1.55, 0.27, 0.13],
    [0.14, 0.38, 0.75, 1.45, 0.24, 0.18],
    [0.26, 0.49, 2.30, 1.90, 0.28, 0.20],
    [0.42, 0.67, 0.95, 1.60, 0.25, 0.14],
    [0.60, 0.88, 1.20, 2.20, 0.26, 0.09],
  ];
  function crownPoint(u, a) {
    const p = left.getPoint(u).lerp(right.getPoint(u), (Math.cos(a) + 1) * 0.5);
    let z = Math.max(0.002, depths.getPoint(u).y) * Math.sin(a);
    for (const [start, end, a0, a1, width, depth] of creases) {
      const t = (u - start) / (end - start);
      if (t > 0 && t < 1) {
        const axis = THREE.MathUtils.lerp(a0, a1, t);
        const d = Math.atan2(Math.sin(a - axis), Math.cos(a - axis));
        const envelope = Math.sin(Math.PI * t) ** 2;
        z -= depth * Math.exp(-((d / width) ** 2)) * envelope;
        z += depth * 0.38 * Math.exp(-(((d + width * 1.5) / (width * 1.8)) ** 2)) * envelope;
      }
    }
    p.z = z;
    return p;
  }
  const crownColor = (u, angle) => {
    const a = angle * TAU;
    let pigment = 0.98;
    for (const [start, end, a0, a1, width] of creases) {
      const t = (u - start) / (end - start);
      if (t > 0 && t < 1) {
        const delta = Math.atan2(
          Math.sin(a - THREE.MathUtils.lerp(a0, a1, t)),
          Math.cos(a - THREE.MathUtils.lerp(a0, a1, t)),
        );
        pigment -= 0.35 * Math.exp(-((delta / (width * 1.4)) ** 2)) * Math.sin(Math.PI * t) ** 2;
      }
    }
    return new THREE.Color().setScalar(pigment);
  };
  const crown = new THREE.Mesh(
    outward(surfaceGeometry(160, 128, (u, a) => crownPoint(u, a * TAU), crownColor)),
    coloredCloth,
  );
  crown.receiveShadow = true;
  root.add(crown);
  inkOutline(crown);

  // A separate draped band adds overlapping folds at the base of the crown.
  const band = new THREE.Mesh(
    outward(
      surfaceGeometry(
        12,
        96,
        (t, a) => {
          const angle = a * TAU;
          const u = 0.015 + t * 0.105 + 0.018 * Math.sin(angle * 2 + 0.4);
          const p = crownPoint(Math.max(0, u), angle);
          const raised = 0.008 + 0.045 * Math.sin(t * Math.PI);
          p.add(v(Math.cos(angle) * raised, 0, Math.sin(angle) * raised));
          p.y += 0.025 * Math.sin(t * 8 + angle * 3);
          return p;
        },
        (t, a) => clothColor(t * 0.1, a).multiplyScalar(0.88),
      ),
    ),
    coloredCloth,
  );
  root.add(band);

  // Sample the actual folded crown once; every eyelid vertex then follows its
  // surface without running raycasts in the animation loop.
  crown.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const nx = 40,
    ny = 25,
    x0 = -1.02,
    y0 = 1.24,
    dx = 1.95 / nx,
    dy = 0.9 / ny;
  const field = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      ray.set(v(x0 + i * dx, y0 + j * dy, 4), v(0, 0, -1));
      const hits = ray.intersectObject(crown, false);
      field[j * (nx + 1) + i] = hits.length ? hits[0].point.z : 0.1;
    }
  function surfaceZ(x, y) {
    const fx = THREE.MathUtils.clamp((x - x0) / dx, 0, nx - 0.0001);
    const fy = THREE.MathUtils.clamp((y - y0) / dy, 0, ny - 0.0001);
    const i = Math.floor(fx),
      j = Math.floor(fy),
      a = fx - i,
      b = fy - j;
    const z = (ix, iy) => field[iy * (nx + 1) + ix];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(z(i, j), z(i + 1, j), a),
      THREE.MathUtils.lerp(z(i, j + 1), z(i + 1, j + 1), a),
      b,
    );
  }
  // Open a real socket in the crown. The overlapping cloth lips conceal its
  // triangulated boundary; the reverse side of the crown stays intact.
  const socketIndices = [];
  const position = crown.geometry.attributes.position;
  const sourceIndices = crown.geometry.index.array;
  for (let i = 0; i < sourceIndices.length; i += 3) {
    const ids = [sourceIndices[i], sourceIndices[i + 1], sourceIndices[i + 2]];
    const center = ids
      .reduce((p, id) => p.add(v(position.getX(id), position.getY(id), position.getZ(id))), v(0, 0, 0))
      .multiplyScalar(1 / 3);
    const x = center.x + 0.12;
    const u = (x / 0.82 + 1) / 2;
    const arch = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 1.25);
    const y = center.y - 1.68 + 0.1 * x;
    const inSocket = u > 0 && u < 1 && center.z > 0 && y < 0.25 * arch - 0.025 && y > -0.2 * arch + 0.025;
    if (!inSocket) socketIndices.push(...ids);
  }
  crown.geometry.setIndex(socketIndices);
  const eye = createEye(gold, cloth, surfaceZ);
  root.add(eye.root);
  const largeStar = star(0.24, gold);
  largeStar.position.set(-0.4, 2.42, 0.72);
  largeStar.rotation.x = -0.35;
  largeStar.rotation.z = -0.15;
  root.add(largeStar);
  const smallStar = star(0.16, gold);
  smallStar.position.set(0.5, 2.1, 0.8);
  smallStar.rotation.x = -0.35;
  root.add(smallStar);
  for (const ornament of [largeStar, smallStar]) {
    ray.set(v(ornament.position.x, ornament.position.y, 4), v(0, 0, -1));
    const hit = ray.intersectObject(crown, false)[0];
    if (hit) {
      ornament.position.z = hit.point.z + 0.018;
      if (hit.normal) ornament.quaternion.setFromUnitVectors(v(0, 0, 1), hit.normal.normalize());
    }
  }

  const charm = new THREE.Group();
  charm.position.set(1.02, 1.39, 1.01);
  charm.rotation.y = 0.25;
  charm.rotation.z = -0.15;
  const crescentShape = new THREE.Shape();
  crescentShape.absarc(0, 0, 0.285, 0.3 * Math.PI, 1.7 * Math.PI, false);
  crescentShape.bezierCurveTo(0.02, -0.245, -0.17, -0.16, -0.17, 0);
  crescentShape.bezierCurveTo(
    -0.17,
    0.16,
    0.02,
    0.245,
    Math.cos(0.3 * Math.PI) * 0.285,
    Math.sin(0.3 * Math.PI) * 0.285,
  );
  const moon = new THREE.Mesh(
    new THREE.ExtrudeGeometry(crescentShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 2,
      curveSegments: 48,
    }),
    gold,
  );
  charm.add(moon);
  const pendant = new THREE.Group();
  pendant.position.set(0, -0.28, 0.05);
  pendant.rotation.x = -0.5;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 20), gold);
  loop.scale.x = 0.67;
  loop.position.y = -0.045;
  pendant.add(loop);
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: '#b44cde',
    roughness: 0.13,
    metalness: 0.28,
    flatShading: true,
    emissive: '#651b90',
    emissiveIntensity: 0.3,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.155, 0), crystalMaterial);
  crystal.scale.set(0.72, 1.65, 0.65);
  crystal.position.set(0, -0.3, 0);
  crystal.rotation.y = 0.3;
  pendant.add(crystal);
  charm.add(pendant);
  const chainPoints = Array.from({ length: 31 }, (_, i) => {
    const t = i / 30;
    return v(0.06 + t * 0.71, -0.29 - 0.16 * Math.sin(t * Math.PI) + t * 0.03, -t * 0.37);
  });
  charm.add(tube(chainPoints, 0.013, gold));
  for (let i = 1; i < 16; i++) {
    const p = chainPoints[i * 2];
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 4, 8), brightGold);
    link.position.copy(p);
    link.rotation.set(0, 0.4, i % 2 ? Math.PI / 3 : 0);
    charm.add(link);
  }
  root.add(charm);
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  root.rotation.y = -0.1;
  return { root, eye, pendant, crystal, crown, brim };
}
