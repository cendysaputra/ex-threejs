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
  base.addColorStop(0.0, '#b2bde6');
  base.addColorStop(0.3, '#bcbae2');
  base.addColorStop(0.55, '#cbbde2');
  base.addColorStop(0.8, '#efd4e3');
  base.addColorStop(1.0, '#fde2e6');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // cooler on the right, warmer on the left
  const side = ctx.createLinearGradient(0, 0, S, 0);
  side.addColorStop(0.0, 'rgba(255, 205, 225, 0.55)');
  side.addColorStop(0.35, 'rgba(255, 205, 225, 0.0)');
  side.addColorStop(0.7, 'rgba(160, 150, 235, 0.0)');
  side.addColorStop(1.0, 'rgba(150, 140, 230, 0.35)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, S, S);

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
      [0, 'rgba(255, 196, 210, 0.6)'],
      [0.5, 'rgba(255, 200, 214, 0.28)'],
      [1, 'rgba(255, 205, 220, 0)'],
    ]);
  }

  // warm light spilling from the eyes onto the glass
  for (const e of eyes) {
    radial(ctx, px(e.u), py(e.v), S * 0.2, S * 0.26, [
      [0, 'rgba(255, 240, 222, 0.95)'],
      [0.35, 'rgba(255, 224, 212, 0.6)'],
      [0.7, 'rgba(252, 206, 218, 0.22)'],
      [1, 'rgba(250, 200, 220, 0)'],
    ]);
  }
  radial(ctx, px(smile.u), py(smile.v), S * 0.07, S * 0.05, [
    [0, 'rgba(255, 230, 220, 0.6)'],
    [1, 'rgba(255, 220, 225, 0)'],
  ]);

  // soft window reflection along the upper left of the glass
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = S * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(S * 0.5, S * 0.56, S * 0.4, S * 0.4, 0, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.restore();

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
      const g = 252 - 26 * h;
      const b = 238 - 34 * h;
      const a = Math.max(inside, (1 - h) ** 2.4 * 0.5);
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
