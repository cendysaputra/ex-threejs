import * as THREE from 'three';
import { createIrisMaterial } from './iris.js';

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
  const eyeMaterial = iris.material;
  const width = 0.75,
    halfHeight = 0.235;
  function onCloth(x, y, lift = 0.04) {
    return v(x, y, surfaceZ(x - 0.12, y + 1.68) - 0.9 + lift);
  }
  const almond = (u, upper, open) => {
    const x = (u * 2 - 1) * width;
    const arch = Math.pow(Math.max(0, 1 - (x / width) ** 2), 0.9);
    return onCloth(x, 0.035 * x + (upper ? 1 : -1) * halfHeight * arch * open);
  };
  const lensGeo = surfaceGeometry(14, 64, (a, u) => {
    const lo = almond(u, false, 1),
      hi = almond(u, true, 1);
    return lo.lerp(hi, a).add(v(0, 0, 0.035 * Math.sin(a * Math.PI)));
  });
  const lens = new THREE.Mesh(lensGeo, eyeMaterial);
  root.add(lens);
  const upperGold = tube(
    Array.from({ length: 45 }, (_, i) => almond(i / 44, true, 1)),
    0.027,
    gold,
  );
  const lowerGold = tube(
    Array.from({ length: 45 }, (_, i) => almond(i / 44, false, 1)),
    0.023,
    gold,
  );
  root.add(upperGold, lowerGold);
  // Cloth extends out from the socket, so this reads as an eye in the hat itself.
  const lids = [true, false].map((upper) => {
    const geometry = surfaceGeometry(8, 64, (a, u) => {
      const inside = almond(u, upper, 1);
      const outside = almond(u, upper, 1);
      outside.y += (upper ? 1 : -1) * 0.13 * Math.sin(Math.PI * u);
      outside.z -= 0.045;
      return inside.lerp(outside, a);
    });
    const mesh = new THREE.Mesh(geometry, cloth);
    root.add(mesh);
    return mesh;
  });
  // Deliberately tapered gold wings, rather than a circular badge around the eye.
  for (const side of [-1, 1]) {
    root.add(
      tube([onCloth(side * 0.6, 0.12), onCloth(side * 0.76, 0.065), onCloth(side * 0.85, 0.03)], 0.014, gold),
    );
  }
  function setOpen(open) {
    const pos = lensGeo.attributes.position;
    let index = 0;
    for (let i = 0; i <= 14; i++)
      for (let j = 0; j <= 64; j++) {
        const a = i / 14,
          u = j / 64;
        const p = almond(u, false, open).lerp(almond(u, true, open), a);
        p.z += 0.035 * Math.sin(a * Math.PI) * open;
        pos.setXYZ(index++, p.x, p.y, p.z);
      }
    pos.needsUpdate = true;
    for (let k = 0; k < 2; k++) {
      const upper = k === 0,
        attr = lids[k].geometry.attributes.position;
      index = 0;
      for (let i = 0; i <= 8; i++)
        for (let j = 0; j <= 64; j++) {
          const a = i / 8,
            u = j / 64;
          const p = almond(u, upper, open);
          const outer = almond(u, upper, 1);
          outer.y += (upper ? 1 : -1) * 0.13 * Math.sin(Math.PI * u);
          outer.z -= 0.045;
          p.lerp(outer, a);
          attr.setXYZ(index++, p.x, p.y, p.z);
        }
      attr.needsUpdate = true;
      lids[k].geometry.computeVertexNormals();
    }
    for (const [mesh, upper, radius] of [
      [upperGold, true, 0.027],
      [lowerGold, false, 0.023],
    ]) {
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 45 }, (_, i) => almond(i / 44, upper, open)),
      );
      const geometry = new THREE.TubeGeometry(curve, 180, radius, 6, false);
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    }
  }
  // Build the two aperture poses once. GPU morphing keeps the iris round while
  // the cloth lids cover it, with no geometry allocations during a blink.
  const meshes = [lens, ...lids, upperGold, lowerGold];
  const opened = meshes.map((mesh) => mesh.geometry.attributes.position.array.slice());
  setOpen(0.015);
  const closed = meshes.map((mesh) => mesh.geometry.attributes.position.array.slice());
  meshes.forEach((mesh, i) => {
    mesh.geometry.attributes.position.array.set(opened[i]);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(closed[i], 3)];
    mesh.updateMorphTargets();
    mesh.morphTargetInfluences[0] = 0;
    mesh.geometry.computeVertexNormals();
  });
  return {
    root,
    setOpen(open) {
      for (const mesh of meshes) mesh.morphTargetInfluences[0] = 1 - THREE.MathUtils.clamp(open, 0, 1);
    },
    look: iris.look,
    get openness() {
      return 1 - lens.morphTargetInfluences[0];
    },
  };
}

export function createWitchHat() {
  const root = new THREE.Group();
  const cloth = new THREE.MeshPhysicalMaterial({
    color: '#583070',
    roughness: 0.74,
    sheen: 0.8,
    sheenColor: '#c39adf',
    sheenRoughness: 0.55,
    side: THREE.DoubleSide,
  });
  const coloredCloth = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.72,
    sheen: 0.75,
    sheenColor: '#ba8dd8',
    sheenRoughness: 0.65,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  coloredCloth.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;',
    );
  };
  const gold = new THREE.MeshStandardMaterial({ color: '#f3c596', roughness: 0.27, metalness: 0.76 });
  const brightGold = new THREE.MeshStandardMaterial({ color: '#ffe0af', roughness: 0.24, metalness: 0.65 });
  const base = new THREE.Color('#5c3476');
  const clothColor = (u, a) => {
    const theta = a * TAU;
    const fold = Math.sin(theta * 5 + u * 7) * 0.5 + Math.sin(theta * 8 - u * 8) * 0.15;
    const shade = 0.96 + fold * 0.035;
    return base.clone().multiplyScalar(shade);
  };
  function brimPoint(t, a) {
    const r = 1.1 + t * 1.96;
    const ellipse = 1 + 0.045 * Math.sin(3 * a + 0.4);
    const wave =
      (0.43 * Math.cos(2 * a + 1.3) + 0.22 * Math.sin(3 * a - 1.2) + 0.1 * Math.cos(a + 0.5)) *
      Math.pow(t, 1.6);
    const angle = Math.atan2(Math.sin(a - 2.3), Math.cos(a - 2.3));
    const curl = 0.68 * Math.exp(-((angle / 0.58) ** 2)) * t ** 7;
    const drape = 0.16 * Math.sin(t * 4 + a * 3) * Math.sin(t * Math.PI) * t;
    const y = 0.92 - 0.36 * t + wave + drape + curl;
    return v(r * Math.cos(a) * ellipse, y, r * Math.sin(a) * 0.78 * ellipse);
  }
  const brim = new THREE.Mesh(
    surfaceGeometry(44, 192, (t, a) => brimPoint(t, a * TAU), clothColor),
    coloredCloth,
  );
  brim.receiveShadow = true;
  root.add(brim);

  const edgePoints = Array.from({ length: 145 }, (_, i) => brimPoint(1, (i / 144) * TAU).add(v(0, 0.008, 0)));
  root.add(tube(edgePoints, 0.025, gold, true));
  const innerStitch = Array.from({ length: 145 }, (_, i) =>
    brimPoint(0.977, (i / 144) * TAU).add(v(0, 0.012, 0)),
  );
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
    ].map(([offset, t]) => brimPoint(t, a + offset).add(v(0, 0.025, 0)));
    root.add(tube(points, 0.016, gold));
    const motif = star(0.075, brightGold);
    motif.position.copy(brimPoint(0.95, a).add(v(0, 0.028, 0)));
    motif.rotation.x = -Math.PI / 2;
    root.add(motif);
  }

  const center = new THREE.CatmullRomCurve3(
    [
      v(0, 0.82, 0),
      v(-0.06, 1.45, 0),
      v(-0.14, 2.2, 0),
      v(0.03, 2.94, 0),
      v(0.47, 3.75, -0.02),
      v(0.92, 3.6, -0.01),
      v(1.31, 3.1, 0),
      v(1.85, 2.85, 0.02),
      v(2.06, 2.38, 0.06),
      v(1.93, 2.03, 0.1),
    ],
    false,
    'catmullrom',
    0.35,
  );
  const radii = [1.23, 1.05, 0.82, 0.61, 0.25, 0.25, 0.23, 0.16, 0.085, 0.002];
  const radiusCurve = new THREE.SplineCurve(radii.map((r, i) => new THREE.Vector2(i / 9, r)));
  function crownPoint(u, a) {
    const p = center.getPoint(u),
      tangent = center.getTangent(u);
    const xAxis = v(tangent.y, -tangent.x, 0).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, tangent).normalize();
    let r = Math.max(0.002, radiusCurve.getPoint(u).y);
    const fold = 0.026 * Math.sin(a * 5 + u * 7) + 0.009 * Math.sin(a * 8 - u * 8);
    r *= 1 + fold;
    return p.addScaledVector(xAxis, Math.cos(a) * r).addScaledVector(zAxis, Math.sin(a) * r * 0.88);
  }
  const crown = new THREE.Mesh(
    outward(surfaceGeometry(160, 128, (u, a) => crownPoint(u, a * TAU), clothColor)),
    coloredCloth,
  );
  crown.receiveShadow = true;
  root.add(crown);

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
  const eye = createEye(gold, cloth, surfaceZ);
  root.add(eye.root);
  const largeStar = star(0.24, gold);
  largeStar.position.set(-0.62, 2.34, 0.72);
  largeStar.rotation.x = -0.35;
  largeStar.rotation.z = -0.15;
  root.add(largeStar);
  const smallStar = star(0.16, gold);
  smallStar.position.set(0.5, 2.1, 0.8);
  smallStar.rotation.x = -0.35;
  root.add(smallStar);

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
