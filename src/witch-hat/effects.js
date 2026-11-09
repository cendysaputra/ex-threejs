import * as THREE from 'three';

export function createEffects(scene) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 5),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { opacity: { value: 0.13 } },
      vertexShader: `varying vec2 st; void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 st; uniform float opacity;
      void main(){float d=length((st-.5)*2.);gl_FragColor=vec4(.32,.18,.42,exp(-d*d*7.)*opacity*smoothstep(1.,.5,d));
      #include <colorspace_fragment>
      }`,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.14;
  scene.add(shadow);

  const count = 26;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996323,
      r = 1.6 + (i % 7) * 0.23;
    positions.set([Math.cos(a) * r, 0.4 + (i / count) * 3.6, Math.sin(a) * r * 0.7], i * 3);
    seeds[i] = (i * 0.6180339887) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float seed; uniform float time; uniform float pixelRatio; varying float fade;
      void main(){
        vec3 p=position;
        float phase=fract(seed+time*.035);
        p.y=.25+phase*4.2;
        p.x+=sin(time*.4+seed*25.)*.15;
        p.z+=cos(time*.4+seed*25.)*.12;
        fade=sin(phase*3.1415926)*(.24+.20*sin(time+seed*60.));
        vec4 viewPosition=modelViewMatrix*vec4(p,1.);
        gl_PointSize=(3.+seed*3.)*pixelRatio*min(1.3,10./-viewPosition.z);
        gl_Position=projectionMatrix*viewPosition;
      }`,
    fragmentShader: `varying float fade;
      void main(){
        vec2 p=abs(gl_PointCoord-.5)*2.;
        float crossShape=pow(max(0.,1.-p.x-p.y),2.);
        gl_FragColor=vec4(.65,.38,.77,crossShape*fade);
        #include <colorspace_fragment>
      }`,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  scene.add(particles);
  return {
    update(time) {
      material.uniforms.time.value = time;
      shadow.material.uniforms.opacity.value = 0.12 - Math.sin(time * 1.3) * 0.012;
      shadow.scale.setScalar(1 + Math.sin(time * 1.3) * 0.025);
    },
    setPixelRatio(value) {
      material.uniforms.pixelRatio.value = value;
    },
    setReducedMotion(value) {
      particles.visible = !value;
    },
  };
}
