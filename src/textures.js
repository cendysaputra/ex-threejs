import * as THREE from 'three';

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function radial(ctx, x, y, rx, ry, stops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * Visor glass colour, painted in visor space: u,v in [-1, 1] map to the
 * whole canvas (v = 1 is the top edge).
 */
export function makeVisorTexture({ eyes, smile }) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const px = (u) => (u * 0.5 + 0.5) * S;
  const py = (v) => (0.5 - v * 0.5) * S;

  // lavender at the top melting into pink at the bottom
  const base = ctx.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0.0, '#aab9ea');
  base.addColorStop(0.3, '#b5b3e6');
  base.addColorStop(0.55, '#c7b8e4');
  base.addColorStop(0.8, '#f1d2e0');
  base.addColorStop(1.0, '#fde1e0');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // warm peach on the left, deeper violet in the upper right
  const side = ctx.createLinearGradient(0, 0, S, 0);
  side.addColorStop(0.0, 'rgba(255, 214, 214, 0.55)');
  side.addColorStop(0.35, 'rgba(255, 214, 214, 0.0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, S, S);
  radial(ctx, px(0.85), py(0.65), S * 0.42, S * 0.34, [
    [0, 'rgba(135, 105, 200, 0.42)'],
    [0.6, 'rgba(135, 105, 200, 0.18)'],
    [1, 'rgba(135, 105, 200, 0)'],
  ]);
  // the pink glow wraps around the bottom right too
  radial(ctx, px(0.7), py(-0.75), S * 0.4, S * 0.25, [
    [0, 'rgba(255, 196, 214, 0.55)'],
    [1, 'rgba(255, 196, 214, 0)'],
  ]);

  // deeper tint towards the rim gives the glass some depth
  radial(ctx, S / 2, S / 2, S * 0.7, S * 0.7, [
    [0, 'rgba(120, 100, 190, 0)'],
    [0.6, 'rgba(120, 100, 190, 0)'],
    [0.85, 'rgba(125, 105, 195, 0.22)'],
    [1, 'rgba(125, 105, 195, 0.4)'],
  ]);

  // rosy cheeks
  for (const e of eyes) {
    radial(ctx, px(e.u * 1.08), py(e.v - 0.42), S * 0.2, S * 0.13, [
      [0, 'rgba(255, 202, 208, 0.6)'],
      [0.5, 'rgba(255, 206, 212, 0.28)'],
      [1, 'rgba(255, 210, 218, 0)'],
    ]);
  }

  // warm light spilling from the eyes onto the glass
  for (const e of eyes) {
    radial(ctx, px(e.u), py(e.v), S * 0.19, S * 0.25, [
      [0, 'rgba(255, 222, 222, 1)'],
      [0.5, 'rgba(255, 212, 220, 0.7)'],
      [0.75, 'rgba(253, 204, 220, 0.28)'],
      [1, 'rgba(250, 200, 220, 0)'],
    ]);
  }
  radial(ctx, px(smile.u), py(smile.v), S * 0.07, S * 0.05, [
    [0, 'rgba(255, 214, 220, 0.6)'],
    [1, 'rgba(255, 210, 222, 0)'],
  ]);

  return canvasTexture(canvas);
}

/** Soft glowing eye: bright cream core fading to a warm rim. */
export function makeEyeTexture(n, core) {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = ((i + 0.5) / S) * 2 - 1;
      const v = ((j + 0.5) / S) * 2 - 1;
      const s = Math.pow(Math.abs(u) ** n + Math.abs(v) ** n, 1 / n);
      // 0 inside the eye, 1 at the outer edge of the halo
      const h = smooth(core - 0.04, 1, s);
      const inside = 1 - smooth(core - 0.035, core + 0.01, s);
      const r = 255;
      // warm cream core with a thin rosy glow around it
      const g = 252 - 50 * h;
      const b = 238 - 26 * h;
      const a = Math.max(inside, (1 - h) ** 1.8 * 0.6);
      const k = (j * S + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(canvas);
}

/** Ear speaker face: peach outer ring, glowing cyan ring, pale blue centre. */
export function makeEarTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, '#d9eeff');
  g.addColorStop(0.45, '#c6e4fb');
  g.addColorStop(0.62, '#a9dcf7');
  g.addColorStop(0.68, '#7ff3ff');
  g.addColorStop(0.74, '#92f6ff');
  g.addColorStop(0.79, '#d5f4fb');
  g.addColorStop(0.84, '#ffe2d8');
  g.addColorStop(0.92, '#ffd3cc');
  g.addColorStop(1.0, '#e8c3e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(canvas);
}

/** Soft round blob used for glows. */
export function makeGlowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  radial(ctx, S / 2, S / 2, S / 2, S / 2, [
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,255,255,0.45)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  return canvasTexture(canvas);
}

/** Soft round shadow blob for contact shadows on the floor. */
export function makeBlobTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  radial(ctx, S / 2, S / 2, S / 2, S / 2, [
    [0, 'rgba(120, 100, 170, 1)'],
    [0.5, 'rgba(120, 100, 170, 0.45)'],
    [1, 'rgba(120, 100, 170, 0)'],
  ]);
  return canvasTexture(canvas);
}

/** Beach-ball style stripes for the toy ball (equirectangular). */
export function makeBallTexture() {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const colors = ['#a9cdf7', '#ffffff', '#f6b8df', '#ffffff', '#c6b5f4', '#ffffff'];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect((i * W) / colors.length, 0, W / colors.length + 1, H);
  });
  // white caps at the poles
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H * 0.08);
  ctx.fillRect(0, H * 0.92, W, H * 0.08);
  return canvasTexture(canvas);
}
