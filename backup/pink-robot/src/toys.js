import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { plastic } from './robot.js';
import { makeBallTexture, makeBlobTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Pastel toys scattered on the floor around the robot. They can be picked up
// and dragged (or flung), and hop with a flip when tapped; the round ones roll.
// The robot glances at whatever is played with.
// ---------------------------------------------------------------------------

const GRAVITY = 9.8;
const ROBOT_RADIUS = 1.15; // toys stay clear of the robot's body and feet
// and inside this patch of floor (relative to the robot), which keeps them in frame
const PLAY = { side: 3.4, back: 2.2, front: 1.9 };
const HOLD_HEIGHT = 0.45; // dragged toys are lifted off the floor this much
const HOP_SPEED = 3.3;

function starGeometry(outer, inner, depth) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.04,
    bevelSegments: 5,
    curveSegments: 4,
  }).center();
}

function coneGeometry(radius, height) {
  // a party-hat cone with a soft tip and a rounded rim
  const pts = [
    [0, -height / 2],
    [radius * 0.85, -height / 2],
    [radius, -height / 2 + 0.03],
    [radius * 0.96, -height / 2 + 0.06],
    [0.035, height / 2 - 0.03],
    [0, height / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getSpacedPoints(40), 64);
}

const FLOOR_TOYS = [
  // left of the robot
  {
    name: 'pink block',
    make: () => new RoundedBoxGeometry(0.46, 0.46, 0.46, 5, 0.09),
    color: '#f5b6df',
    height: 0.46,
    radius: 0.3,
    x: -2.05,
    z: 0.55,
    yaw: 0.4,
  },
  {
    name: 'lilac block',
    make: () => new RoundedBoxGeometry(0.34, 0.34, 0.34, 5, 0.07),
    color: '#c4b3f3',
    height: 0.34,
    radius: 0.23,
    x: -2.65,
    z: -0.55,
    yaw: -0.3,
  },
  {
    name: 'cone',
    make: () => coneGeometry(0.19, 0.38),
    color: '#ffcdb8',
    height: 0.38,
    radius: 0.2,
    x: -1.45,
    z: 1.35,
    yaw: 0,
  },
  {
    name: 'star',
    make: () => starGeometry(0.25, 0.115, 0.06).rotateX(-Math.PI / 2),
    color: '#ffd8a8',
    extra: { emissive: new THREE.Color('#ffcf94'), emissiveIntensity: 0.35, clearcoat: 0.8 },
    height: 0.14,
    radius: 0.27,
    x: -3.05,
    z: 0.65,
    yaw: 0.25,
  },
  {
    name: 'pink marble',
    make: () => new THREE.SphereGeometry(0.12, 32, 24),
    color: '#ffc6e6',
    extra: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 },
    height: 0.24,
    radius: 0.12,
    x: -2.35,
    z: 1.5,
    yaw: 0,
    rolls: true,
  },
  // right of the robot
  {
    name: 'ball',
    make: () => new THREE.SphereGeometry(0.26, 48, 32),
    map: makeBallTexture,
    height: 0.52,
    radius: 0.26,
    x: 1.85,
    z: 0.8,
    yaw: 0.3,
    rolls: true,
  },
  {
    name: 'ring',
    make: () => new THREE.TorusGeometry(0.22, 0.09, 24, 64).rotateX(Math.PI / 2),
    color: '#a9c8f5',
    height: 0.18,
    radius: 0.31,
    x: 2.65,
    z: -0.25,
    yaw: 0,
  },
  {
    name: 'pill',
    make: () => new THREE.CapsuleGeometry(0.11, 0.26, 10, 24).rotateZ(Math.PI / 2),
    color: '#bdebdc',
    height: 0.22,
    radius: 0.24,
    x: 1.3,
    z: 1.5,
    yaw: 0.6,
  },
  {
    name: 'blue marble',
    make: () => new THREE.SphereGeometry(0.1, 32, 24),
    color: '#c9defc',
    extra: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 },
    height: 0.2,
    radius: 0.1,
    x: 3.05,
    z: 0.9,
    yaw: 0,
    rolls: true,
  },
  {
    name: 'lilac marble',
    make: () => new THREE.SphereGeometry(0.14, 32, 24),
    color: '#dccdfb',
    extra: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 },
    height: 0.28,
    radius: 0.14,
    x: 3.0,
    z: -0.95,
    yaw: 0,
    rolls: true,
  },
];

export function createToys({ scene, camera, canvas, controls, robot, animator, onRobotTap }) {
  const group = new THREE.Group();
  group.name = 'toys';
  scene.add(group);

  const blobTex = makeBlobTexture();
  const toys = [];
  const pickables = [];

  // --- floor toys ---------------------------------------------------------
  for (const spec of FLOOR_TOYS) {
    const material = spec.map
      ? plastic('#ffffff', { map: spec.map(), clearcoat: 0.6, clearcoatRoughness: 0.15 })
      : plastic(spec.color, { clearcoat: 0.5, clearcoatRoughness: 0.2, ...spec.extra });
    const mesh = new THREE.Mesh(spec.make(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // root sits on the floor; squash scales from the bottom; spin turns around the centre
    const root = new THREE.Group();
    const squash = new THREE.Group();
    const spin = new THREE.Group();
    spin.position.y = spec.height / 2;
    spin.add(mesh);
    squash.add(spin);
    root.add(squash);
    group.add(root);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    shadow.scale.setScalar(spec.radius * 2.8);
    group.add(shadow);

    const toy = {
      spec,
      root,
      squash,
      spin,
      mesh,
      shadow,
      pos: new THREE.Vector2(spec.x, spec.z),
      vel: new THREE.Vector2(),
      y: 0,
      vy: 0,
      orient: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.yaw),
      flip: null,
      sq: 0,
      sqv: 0,
      hover: 0,
    };
    mesh.userData.toy = toy;
    pickables.push(mesh);
    toys.push(toy);
  }

  // --- pointer interaction ------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const robotMeshes = [];
  robot.traverse((o) => o.isMesh && robotMeshes.push(o));

  let hovered = null;
  let drag = null;
  let press = null;
  let now = 0;

  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...pickables, ...robotMeshes], false);
    for (const h of hits) {
      if (h.object.userData.toy) return h.object.userData.toy;
      if (h.object.visible) return 'robot';
    }
    return null;
  }

  function floorPoint(e, height) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -height;
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }

  function worldPos(toy) {
    return new THREE.Vector3(toy.pos.x, toy.y + toy.spec.height / 2, toy.pos.y);
  }

  function tapToy(toy) {
    animator.lookAt(worldPos(toy), now);
    if (toy.y > 0.02) return;
    toy.vy = HOP_SPEED * (0.9 + Math.random() * 0.2);
    const a = Math.random() * Math.PI * 2;
    toy.flip = {
      start: now,
      duration: (2 * toy.vy) / GRAVITY,
      axis: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
      base: toy.orient.clone(),
    };
    toy.sqv = 2.5; // a little stretch on take-off
  }

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      const target = pick(e);
      press = { x: e.clientX, y: e.clientY, target };
      if (target && target !== 'robot') {
        const center = target.y + target.spec.height / 2;
        const p = floorPoint(e, center);
        drag = {
          toy: target,
          offset: p ? new THREE.Vector2(target.pos.x - p.x, target.pos.y - p.z) : new THREE.Vector2(),
          goal: target.pos.clone(),
          moved: false,
        };
        controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
      }
    },
    { capture: true },
  );

  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) drag.moved = true;
      if (!drag.moved) return;
      const p = floorPoint(e, HOLD_HEIGHT + drag.toy.spec.height / 2);
      if (p) drag.goal.set(p.x + drag.offset.x, p.z + drag.offset.y);
      return;
    }
    if (e.buttons) return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? (hovered === 'robot' ? 'pointer' : 'grab') : '';
  });

  function endPress(e) {
    const tapped = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6;
    if (drag) {
      if (tapped && !drag.moved) tapToy(drag.toy);
      else animator.lookAt(worldPos(drag.toy), now);
      drag = null;
      controls.enabled = true;
      canvas.style.cursor = hovered ? 'grab' : '';
    } else if (tapped && press.target) {
      if (press.target === 'robot') onRobotTap();
      else tapToy(press.target);
    }
    press = null;
  }
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', endPress);

  // --- simulation -----------------------------------------------------------
  const _q = new THREE.Quaternion();
  const _axis = new THREE.Vector3();

  function keepInPlayArea(toy) {
    const cx = robot.position.x;
    const cz = robot.position.z;
    // clear of the robot: push out of its circle and bounce off it
    const dx = toy.pos.x - cx;
    const dz = toy.pos.y - cz;
    const d = Math.hypot(dx, dz) || 1e-6;
    const min = ROBOT_RADIUS + toy.spec.radius;
    if (d < min) {
      const nx = dx / d;
      const nz = dz / d;
      toy.pos.set(cx + nx * min, cz + nz * min);
      const vn = toy.vel.x * nx + toy.vel.y * nz;
      if (vn < 0) toy.vel.set(toy.vel.x - 1.6 * vn * nx, toy.vel.y - 1.6 * vn * nz);
    }
    // inside the play patch: bounce off its edges
    const r = toy.spec.radius;
    const bounds = [
      ['x', cx - PLAY.side + r, cx + PLAY.side - r],
      ['y', cz - PLAY.back + r, cz + PLAY.front - r],
    ];
    for (const [axis, lo, hi] of bounds) {
      if (toy.pos[axis] < lo) {
        toy.pos[axis] = lo;
        if (toy.vel[axis] < 0) toy.vel[axis] *= -0.6;
      } else if (toy.pos[axis] > hi) {
        toy.pos[axis] = hi;
        if (toy.vel[axis] > 0) toy.vel[axis] *= -0.6;
      }
    }
  }

  function separate() {
    for (let i = 0; i < toys.length; i++) {
      for (let j = i + 1; j < toys.length; j++) {
        const a = toys[i];
        const b = toys[j];
        // stacked heights don't overlap: one is well above the other
        if (Math.abs(a.y - b.y) > Math.max(a.spec.height, b.spec.height)) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dz) || 1e-6;
        const overlap = a.spec.radius + b.spec.radius - d;
        if (overlap <= 0) continue;
        const nx = dx / d;
        const nz = dz / d;
        const aHeld = drag && drag.toy === a;
        const bHeld = drag && drag.toy === b;
        const wa = aHeld ? 0 : bHeld ? 1 : 0.5;
        const wb = 1 - wa;
        a.pos.x -= nx * overlap * wa;
        a.pos.y -= nz * overlap * wa;
        b.pos.x += nx * overlap * wb;
        b.pos.y += nz * overlap * wb;
        // trade a bit of momentum so a flung toy knocks the other one along
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * nz;
        if (rel < 0) {
          const imp = -rel * 0.8;
          if (!aHeld) a.vel.set(a.vel.x - nx * imp * wa * 2, a.vel.y - nz * imp * wa * 2);
          if (!bHeld) b.vel.set(b.vel.x + nx * imp * wb * 2, b.vel.y + nz * imp * wb * 2);
        }
      }
    }
  }

  function updateToy(toy, dt) {
    const held = drag && drag.toy === toy && drag.moved;
    const prev = toy.pos.clone();

    if (held) {
      const k = 1 - Math.exp(-dt * 18);
      toy.pos.lerp(drag.goal, k);
      toy.y += (HOLD_HEIGHT - toy.y) * k;
      toy.vy = 0;
      toy.flip = null;
      if (dt > 0) toy.vel.set((toy.pos.x - prev.x) / dt, (toy.pos.y - prev.y) / dt).clampLength(0, 5);
    } else {
      if (toy.y > 0 || toy.vy > 0) {
        toy.vy -= GRAVITY * dt;
        toy.y += toy.vy * dt;
        if (toy.y <= 0) {
          toy.y = 0;
          const impact = -toy.vy;
          toy.vy = impact > 1 ? impact * 0.32 : 0;
          if (impact > 0.8) toy.sq = Math.min(0.24, impact * 0.06);
        }
      }
      toy.pos.addScaledVector(toy.vel, dt);
      if (toy.y === 0) toy.vel.multiplyScalar(Math.exp(-dt * (toy.spec.rolls ? 1.1 : 5)));
      if (toy.vel.lengthSq() < 1e-4) toy.vel.set(0, 0);
    }
    keepInPlayArea(toy);

    // rolling ball turns with the distance it travels
    if (toy.spec.rolls) {
      const mx = toy.pos.x - prev.x;
      const mz = toy.pos.y - prev.y;
      const dist = Math.hypot(mx, mz);
      if (dist > 1e-5) {
        _axis.set(mz, 0, -mx).normalize();
        toy.orient.premultiply(_q.setFromAxisAngle(_axis, dist / toy.spec.radius));
      }
    }

    // flip during a hop, landing exactly the right way up
    if (toy.flip) {
      const f = toy.flip;
      const k = THREE.MathUtils.clamp((now - f.start) / f.duration, 0, 1);
      const eased = k * k * (3 - 2 * k);
      _q.setFromAxisAngle(f.axis, eased * Math.PI * 2);
      toy.spin.quaternion.multiplyQuaternions(_q, f.base);
      if (k >= 1) toy.flip = null;
    } else {
      toy.spin.quaternion.copy(toy.orient);
    }

    // jelly squash spring
    toy.sqv += (-170 * toy.sq - 11 * toy.sqv) * dt;
    toy.sq += toy.sqv * dt;
    const hover = (hovered === toy && !drag) || (drag && drag.toy === toy) ? 1 : 0;
    toy.hover += (hover - toy.hover) * (1 - Math.exp(-dt * 12));
    const s = 1 + toy.hover * 0.07;
    toy.squash.scale.set(s * (1 + toy.sq * 0.5), s * (1 - toy.sq), s * (1 + toy.sq * 0.5));

    toy.root.position.set(toy.pos.x, toy.y, toy.pos.y);
    toy.shadow.position.set(toy.pos.x, 0.003, toy.pos.y);
    const lift = Math.min(1, toy.y * 1.6);
    toy.shadow.material.opacity = 0.16 * (1 - lift * 0.6);
    toy.shadow.scale.setScalar(toy.spec.radius * 2.8 * (1 - lift * 0.3));
  }

  return {
    update(t, dt) {
      now = t;
      dt = Math.min(dt, 1 / 20);
      separate();
      for (const toy of toys) {
        updateToy(toy, dt);
      }
    },
  };
}
