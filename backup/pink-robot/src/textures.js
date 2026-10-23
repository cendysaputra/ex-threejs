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

/**
 * One repeating tile of the play-mat floor: soft pink with staggered polka dots.
 * The tile covers `size` x `size` world units.
 */
export function makeFloorTexture(size, repeat) {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbeef5';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#f5d5e7';
  const r = (0.055 / size) * S;
  for (const [x, y] of [
    [0.25, 0.25],
    [0.75, 0.75],
  ]) {
    ctx.beginPath();
    ctx.arc(x * S, y * S, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 16;
  return tex;
}

/**
 * Glow the eyes cast on the dark visor glass, painted in visor space (u, v in
 * [-1, 1], v = 1 at the top); used as the glass's emissive map.
 */
export function makeVisorGlowTexture({ visor, eye, blush }) {
  const S = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, S, S);
  const px = (u) => (u * 0.5 + 0.5) * S;
  const py = (v) => (0.5 - v * 0.5) * S;

  const strokeEyes = (width, color, blur) => {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    for (const side of [-1, 1]) {
      const cx = side * eye.u * visor.hw;
      const cy = visor.cy + eye.v * visor.hh;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = THREE.MathUtils.degToRad(eye.from + ((eye.to - eye.from) * i) / 40);
        const x = cx + eye.r * Math.cos(a);
        const y = cy + eye.r * (Math.sin(a) - 0.55);
        const X = px(x / visor.hw);
        const Y = py((y - visor.cy) / visor.hh);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  strokeEyes(S * 0.11, 'rgba(70, 190, 230, 0.55)', 30);
  strokeEyes(S * 0.05, 'rgba(120, 225, 255, 0.7)', 10);

  // faint glow around the blush marks
  for (const side of [-1, 1]) {
    radial(ctx, px(side * blush.u), py(blush.v), S * 0.06, S * 0.05, [
      [0, 'rgba(110, 215, 245, 0.45)'],
      [1, 'rgba(110, 215, 245, 0)'],
    ]);
  }

  const tex = canvasTexture(canvas);
  return tex;
}

/**
 * Smoky grey visor glass (colour map, visor space): a little darker at the top,
 * a soft reflection of a studio window in the upper part and a lighter band
 * along the bottom where the glass curves towards the light.
 */
export function makeVisorGlassTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#6c6b73');
  g.addColorStop(0.45, '#77767e');
  g.addColorStop(0.8, '#86848a');
  g.addColorStop(1, '#9a979c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // window reflection
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(190, 190, 198, 0.35)';
  ctx.beginPath();
  ctx.roundRect(S * 0.16, S * 0.12, S * 0.62, S * 0.3, S * 0.05);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 120, 128, 0.5)';
  ctx.fillRect(S * 0.46, S * 0.1, S * 0.03, S * 0.34);
  ctx.restore();
  // brighter left edge where the glass catches the key light
  const side = ctx.createLinearGradient(0, 0, S, 0);
  side.addColorStop(0, 'rgba(200, 200, 208, 0.35)');
  side.addColorStop(0.18, 'rgba(200, 200, 208, 0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(canvas);
}
