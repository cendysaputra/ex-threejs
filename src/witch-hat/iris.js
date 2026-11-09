import * as THREE from 'three';

// Painted in object coordinates, so blinking covers the iris instead of
// squashing the drawing. Highlights are painted like an anime close-up.
export function createIrisMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const background = ctx.createLinearGradient(0, 0, 0, 512);
  background.addColorStop(0, '#211229');
  background.addColorStop(0.6, '#633d75');
  background.addColorStop(1, '#382043');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.save();
  ctx.translate(512, 256);
  ctx.scale(190, 208);
  const iris = ctx.createRadialGradient(0, 0, 0.04, 0, 0, 1);
  iris.addColorStop(0, '#4a1f6a');
  iris.addColorStop(0.33, '#6f2d9a');
  iris.addColorStop(0.65, '#bc65d9');
  iris.addColorStop(0.84, '#9348b8');
  iris.addColorStop(0.96, '#532868');
  iris.addColorStop(1, '#24132e');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 44; i++) {
    const angle = (i * Math.PI * 2) / 44;
    const inner = 0.28 + 0.1 * Math.sin(i * 5.3);
    const outer = 0.87 + 0.06 * Math.sin(i * 2.7);
    ctx.strokeStyle = i % 3 ? '#efb4ff16' : '#35114a16';
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.quadraticCurveTo(
      Math.cos(angle + 0.015) * 0.64,
      Math.sin(angle + 0.015) * 0.64,
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
    );
    ctx.stroke();
  }
  // Large translucent pigment shapes give the lower iris an illustrated glow.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 0.94, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const a = 0.12 + i * Math.PI / 9;
    ctx.fillStyle = i % 2 ? '#e89cff30' : '#ad4eda24';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 0.35, Math.sin(a) * 0.35);
    ctx.lineTo(Math.cos(a - 0.18), Math.sin(a - 0.18));
    ctx.lineTo(Math.cos(a + 0.19), Math.sin(a + 0.19));
    ctx.closePath();
    ctx.fill();
  }
  const lidShadow = ctx.createLinearGradient(0, -1, 0, 0.7);
  lidShadow.addColorStop(0, '#210e36d9');
  lidShadow.addColorStop(0.53, '#2d104524');
  lidShadow.addColorStop(1, '#d47ae900');
  ctx.fillStyle = lidShadow;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.fillStyle = '#140c22';
  ctx.beginPath();
  ctx.moveTo(0, -0.99);
  ctx.bezierCurveTo(0.22, -0.47, 0.17, 0.3, -0.04, 0.98);
  ctx.bezierCurveTo(-0.2, 0.4, -0.18, -0.36, 0, -0.99);
  ctx.fill();
  const light = ctx.createRadialGradient(-0.34, -0.46, 0, -0.34, -0.46, 0.18);
  light.addColorStop(0, '#fff3ff');
  light.addColorStop(0.5, '#fff3ffb0');
  light.addColorStop(1, '#fff3ff00');
  ctx.fillStyle = light;
  ctx.fillRect(-0.6, -0.7, 0.6, 0.6);
  ctx.fillStyle = '#fff0ff';
  ctx.beginPath();
  ctx.ellipse(-0.34, -0.48, 0.085, 0.13, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#edbaff';
  ctx.beginPath();
  ctx.ellipse(0.32, 0.46, 0.035, 0.065, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const look = new THREE.Vector2();
  const material = new THREE.MeshBasicMaterial({ map, color: '#ffffff', side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.eyeLook = { value: look };
    shader.vertexShader = 'varying vec2 eyePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      'eyePosition = transformed.xy;\n#include <project_vertex>',
    );
    shader.fragmentShader = 'varying vec2 eyePosition;\nuniform vec2 eyeLook;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      'diffuseColor *= texture2D(map, (eyePosition - eyeLook) / vec2(1.50, .60) + .5);',
    );
  };
  return { material, look };
}
