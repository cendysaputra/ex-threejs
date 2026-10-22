import * as THREE from 'three';

/**
 * Soft pastel photo studio used for reflections and ambient light:
 * white from above, baby blue from the right, pink from the left, plus a
 * few big softboxes for the glossy highlights.
 */
export function createStudioEnvironment(renderer) {
  const scene = new THREE.Scene();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 top = vec3(1.0, 1.0, 1.0);
          vec3 mid = vec3(0.9, 0.9, 0.98);
          vec3 bottom = vec3(0.86, 0.78, 0.95);
          vec3 c = d.y > 0.0 ? mix(mid, top, pow(d.y, 0.7)) : mix(mid, bottom, pow(-d.y, 0.7));
          c = mix(c, vec3(0.62, 0.8, 1.0), smoothstep(0.1, 0.9, d.x) * 0.75);
          c = mix(c, vec3(1.0, 0.82, 0.92), smoothstep(0.1, 0.9, -d.x) * smoothstep(0.5, -0.4, d.y) * 0.6);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(dome);

  const softbox = (w, h, color, intensity, x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  softbox(14, 8, '#ffffff', 2.2, -6, 9, 8); // key, top left front
  softbox(5, 10, '#a8d2ff', 2.0, 12, 2, 2); // blue strip, right
  softbox(5, 9, '#ffb6df', 1.4, -12, -1, 4); // pink strip, left
  softbox(10, 4, '#ffffff', 1.2, 0, 12, -4); // top back

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  return target.texture;
}
