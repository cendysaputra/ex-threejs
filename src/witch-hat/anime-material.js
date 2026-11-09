import * as THREE from 'three';

// Art-directed, linear-light paint ramps: large shadow masses plus a restrained
// grazing highlight. No environment reflection or plastic specular on fabric.
export function animeMaterial(kind = 'cloth') {
  const palettes = {
    cloth: ['#241731', '#42204f', '#69377f', '#b65dad'],
    gold: ['#955877', '#c58a81', '#f2bf8b', '#ffe8b8'],
  };
  const palette = palettes[kind];
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ink: { value: new THREE.Color(palette[0]) },
      shade: { value: new THREE.Color(palette[1]) },
      base: { value: new THREE.Color(palette[2]) },
      light: { value: new THREE.Color(palette[3]) },
    },
    vertexShader: `
      varying vec3 nWorld; varying vec3 eyeDir;
      #include <morphtarget_pars_vertex>
      void main(){
        #include <morphinstance_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        nWorld=normalize(mat3(modelMatrix)*normal);
        vec4 world=modelMatrix*vec4(transformed,1.);
        eyeDir=cameraPosition-world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      varying vec3 nWorld; varying vec3 eyeDir;
      uniform vec3 ink; uniform vec3 shade; uniform vec3 base; uniform vec3 light;
      void main(){
        vec3 n=normalize(nWorld)*(gl_FrontFacing?1.:-1.);
        float lighting=dot(n,normalize(vec3(-.65,.85,.7)));
        vec3 paint=mix(ink,shade,smoothstep(-.35,-.25,lighting));
        paint=mix(paint,base,smoothstep(.22,.29,lighting));
        paint=mix(paint,light,smoothstep(.83,.9,lighting)*.48);
        float rim=pow(1.-abs(dot(n,normalize(eyeDir))),4.);
        paint=mix(paint,light,rim*.20*smoothstep(-.1,.8,n.y));
        if(!gl_FrontFacing)paint*=.65;
        gl_FragColor=vec4(paint,1.);
        #include <colorspace_fragment>
      }`,
  });
}

export function inkOutline(mesh, width = 0.006) {
  const material = new THREE.MeshBasicMaterial({ color: '#291933', side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed=position+normal*${width};`,
    );
  };
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.castShadow = false;
  mesh.add(outline);
}
