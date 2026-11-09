import * as THREE from 'three';

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

export function createHatAnimator(hat) {
  let time = 0,
    nextBlink = 2.4,
    blinkStart = -10,
    gust = 0;
  let blinkNumber = 0;
  const pointer = new THREE.Vector2();
  const crownGeometry = hat.crown.geometry;
  const original = crownGeometry.attributes.position.array.slice();
  const count = crownGeometry.attributes.position.count;
  const weights = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = crownGeometry.attributes.uv.getY(i);
    weights[i] = smooth(0.3, 1, u);
  }
  // Only the upper crown bends; the sewn ornaments stay anchored below it.
  crownGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

  function blink() {
    blinkStart = time;
    nextBlink = time + 3.2 + ((++blinkNumber * 1.73) % 2.8);
  }
  function enchant() {
    gust = 1;
    blink();
  }

  function update(dt) {
    time += dt;
    if (time >= nextBlink) blink();
    const age = time - blinkStart;
    let openness = 1;
    if (age < 0.105) openness = 1 - smooth(0, 0.105, age);
    else if (age < 0.155) openness = 0.015;
    else if (age < 0.35) openness = smooth(0.155, 0.35, age);
    hat.eye.setOpen(Math.max(0.015, openness));
    const damping = 1 - Math.exp(-dt * 4);
    hat.eye.look.lerp(pointer, damping);
    gust *= Math.exp(-dt * 1.7);

    hat.root.position.y = 0.14 + Math.sin(time * 1.3) * 0.055 + Math.sin(time * 4) * gust * 0.09;
    hat.root.rotation.set(
      Math.sin(time * 0.7) * 0.018,
      -0.1 + Math.sin(time * 0.55) * 0.065,
      Math.sin(time * 0.9) * 0.018 + Math.sin(time * 3.5) * gust * 0.045,
    );
    hat.pendant.rotation.x = -0.5 + Math.sin(time * 1.8 + 0.7) * 0.09;
    hat.pendant.rotation.z = Math.sin(time * 1.5) * 0.13 + Math.sin(time * 5) * gust * 0.25;
    hat.crystal.material.emissiveIntensity = 0.24 + 0.09 * Math.sin(time * 1.4) + gust * 0.45;

    const positions = crownGeometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const j = i * 3,
        w = weights[i];
      positions[j] = original[j] + Math.sin(time * 1.2 + w * 2) * w * (0.035 + gust * 0.08);
      positions[j + 1] = original[j + 1] + Math.sin(time * 1.4 + w * 3) * w * 0.022;
      positions[j + 2] = original[j + 2] + Math.sin(time * 0.9 + w * 2) * w * 0.025;
    }
    crownGeometry.attributes.position.needsUpdate = true;
  }

  return {
    update,
    blink,
    enchant,
    lookAt(x, y) {
      pointer.set(THREE.MathUtils.clamp(x, -1, 1) * 0.07, THREE.MathUtils.clamp(y, -1, 1) * 0.045);
    },
    resetLook() {
      pointer.set(0, 0);
    },
    get time() {
      return time;
    },
  };
}
