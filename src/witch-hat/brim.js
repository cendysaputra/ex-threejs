import * as THREE from 'three';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A broad rolled left eave and a low front hem reproduce the reference's large
// visible underside. The edge rolls gradually across the cloth, not just at its tip.
export function brimPoint(t, angle) {
  const r = 1.08 + t * 2.02;
  const ellipse = 1 + 0.025 * Math.cos(3 * angle + 0.3);
  const left = Math.atan2(Math.sin(angle - 2.25), Math.cos(angle - 2.25));
  const roll = 1.15 * Math.exp(-((left / 0.92) ** 2)) * Math.pow(Math.max(0, t), 2.2);
  const wave = (0.43 * Math.cos(2 * angle + 1.25) + 0.12 * Math.sin(3 * angle - 0.6)) * t * t;
  const folds = 0.115 * Math.sin(3 * angle + t * 3.2) * Math.sin(Math.PI * t);
  const y = 0.88 - 0.39 * t + wave + roll + folds;
  return V(r * Math.cos(angle) * ellipse, y, r * Math.sin(angle) * 0.81 * ellipse);
}

export function brimNormal(t, angle) {
  const dr = brimPoint(t + 0.0001, angle).sub(brimPoint(t - 0.0001, angle));
  const da = brimPoint(t, angle + 0.0001).sub(brimPoint(t, angle - 0.0001));
  return da.cross(dr).normalize();
}

export function brimOnSurface(t, angle, lift = 0.012) {
  return brimPoint(t, angle).addScaledVector(brimNormal(t, angle), 0.027 + lift);
}

export function createBrimGeometry() {
  const rows = 48,
    cols = 192,
    stride = cols + 1,
    count = (rows + 1) * stride;
  const positions = [],
    uvs = [],
    indices = [];
  for (const side of [1, -1]) {
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= cols; j++) {
        const t = i / rows,
          a = (j / cols) * TAU;
        const normal = brimNormal(t, a);
        const thickness = 0.027 + 0.009 * Math.sin(Math.PI * t);
        const p = brimPoint(t, a).addScaledVector(normal, side * thickness);
        positions.push(p.x, p.y, p.z);
        uvs.push(j / cols, t);
      }
  }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j,
        b = a + stride;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
      indices.push(a + count, b + count, a + 1 + count, b + count, b + 1 + count, a + 1 + count);
    }
  for (let j = 0; j < cols; j++) {
    const a = rows * stride + j,
      b = a + 1;
    indices.push(a, b, a + count, b, b + count, a + count);
    indices.push(j, j + count, j + 1, j + 1, j + count, j + 1 + count);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Join duplicated angular endpoints without destroying UVs.
  const normal = geo.attributes.normal;
  for (let side = 0; side < 2; side++)
    for (let i = 0; i <= rows; i++) {
      const a = side * count + i * stride,
        b = a + cols;
      const n = V(
        normal.getX(a) + normal.getX(b),
        normal.getY(a) + normal.getY(b),
        normal.getZ(a) + normal.getZ(b),
      ).normalize();
      normal.setXYZ(a, n.x, n.y, n.z);
      normal.setXYZ(b, n.x, n.y, n.z);
    }
  return geo;
}
