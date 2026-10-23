import * as THREE from 'three';
import { hipLift, LEG_SIT, LEG_STAND } from './robot.js';

// ---------------------------------------------------------------------------
// Stand-up routine: the robot rocks back and forth to build up momentum, puts
// its hands on the floor and pushes up, wobbles and plops back down, shakes its
// head, tries again and makes it, flailing its arms for balance. After a while
// standing it sits back down and the routine starts over.
//
// A pose holds offsets from the sitting pose. Keys list only what changes;
// everything else carries over from the previous key.
// ---------------------------------------------------------------------------

const SIT = { leg: LEG_SIT, hop: 0, pitch: 0, roll: 0, armX: 0, armZ: 0, nod: 0, turn: 0, squash: 1 };
const STAND = { ...SIT, leg: LEG_STAND };

const KEYS = [
  [0, SIT],
  [2.0, {}],
  // ancang-ancang: rock back and forth
  [2.35, { pitch: -0.14, armX: 0.5, nod: -0.08 }],
  [2.75, { pitch: 0.18, armX: -0.45, nod: 0.02 }],
  [3.1, { pitch: -0.16, armX: 0.55, nod: -0.08 }],
  [3.5, { pitch: 0.22, armX: -0.5, nod: 0.02 }],
  // first try: hands on the floor, bottom up...
  [3.9, { pitch: 0.38, armX: -0.34, armZ: -0.25, nod: -0.12, leg: 0.3 }],
  [4.45, { pitch: 0.34, leg: 0.85, roll: 0.04, armX: -0.3, armZ: -0.18 }],
  [4.75, { pitch: 0.24, leg: 1.1, roll: -0.06, armX: -0.2, armZ: 0.5, nod: -0.05 }],
  [5.0, { pitch: 0.05, leg: 1.0, roll: 0.09, armX: 0, armZ: 1.0, nod: -0.05 }],
  // ...and plop, back on its bottom
  [5.3, { ...SIT, pitch: -0.14, squash: 0.86, armZ: 0.45 }],
  [5.5, { pitch: 0.04, squash: 1.04, hop: 0.03, armZ: 0.1 }],
  [5.7, SIT],
  // "hmm" head shake
  [6.0, { turn: -0.22, nod: 0.05 }],
  [6.25, { turn: 0.22 }],
  [6.5, { turn: -0.12 }],
  [6.7, { turn: 0, nod: 0 }],
  // rock again, a bit harder
  [7.0, { pitch: -0.18, armX: 0.6, nod: -0.1 }],
  [7.35, { pitch: 0.24, armX: -0.55, nod: 0.02 }],
  [7.65, { pitch: -0.2, armX: 0.65, nod: -0.1 }],
  // second try: up it goes
  [8.05, { pitch: 0.4, armX: -0.36, armZ: -0.25, nod: -0.12, leg: 0.32 }],
  [8.6, { pitch: 0.36, leg: 0.9, roll: 0.03, armX: -0.3, armZ: -0.18 }],
  [9.0, { pitch: 0.24, leg: 1.25, roll: 0.05, armX: -0.2, armZ: 0.45, nod: -0.05 }],
  // wobbly, arms out for balance
  [9.35, { ...STAND, pitch: 0.06, roll: -0.09, armZ: 1.1, nod: -0.05 }],
  [9.6, { pitch: -0.07, roll: 0.07, armZ: 1.0 }],
  [9.85, { pitch: 0.04, roll: -0.045, armZ: 0.85 }],
  [10.1, { pitch: 0, roll: 0.02, armZ: 0.55 }],
  [10.4, { roll: 0, armZ: 0.1, nod: 0 }],
  // happy little hop
  [10.6, { hop: 0.07, squash: 1.04, armZ: 0.35 }],
  [10.8, { hop: 0, squash: 0.95, armZ: 0.1 }],
  [10.95, STAND],
  [20.0, {}],
  // sit back down
  [20.4, { leg: 1.15, pitch: -0.1, armZ: 0.3 }],
  [20.75, { ...SIT, pitch: -0.15, squash: 0.88, armZ: 0.4 }],
  [20.95, { pitch: 0.04, squash: 1.03, hop: 0.02, armZ: 0 }],
  [21.15, SIT],
  [22.0, {}],
];
const LOOP = KEYS[KEYS.length - 1][0];
const START_TRY = 2.0; // where the sitting rest ends and the rocking begins
const IDLE = [
  [0, START_TRY], // sitting
  [10.95, 20.0], // standing
  [21.15, LOOP], // sitting again
];

// resolve the carried-over values once
const TIMELINE = [];
for (const [t, change] of KEYS) {
  const prev = TIMELINE.length ? TIMELINE[TIMELINE.length - 1].pose : SIT;
  TIMELINE.push({ t, pose: { ...prev, ...change } });
}

const smooth = (x) => x * x * (3 - 2 * x);

function poseAt(time, out) {
  let i = 0;
  while (i < TIMELINE.length - 2 && TIMELINE[i + 1].t <= time) i++;
  const a = TIMELINE[i];
  const b = TIMELINE[i + 1];
  const k = smooth(THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1));
  for (const key in a.pose) out[key] = a.pose[key] + (b.pose[key] - a.pose[key]) * k;
  return out;
}

function idleWindow(time) {
  for (const [from, to] of IDLE) if (time >= from && time < to) return to;
  return null;
}

// ---------------------------------------------------------------------------

const WAVE_RAISE = 0.45;
const WAVE_HOLD = 2.4;
const WAVE_LOWER = 0.55;
const WAVE_LEN = WAVE_RAISE + WAVE_HOLD + WAVE_LOWER;

export function createAnimator(robot) {
  const { neckY, upper, neck, eyes, ears, antennae, arms, legs, barGlow } = robot.userData;
  const base = {
    position: robot.position.clone(),
    rotationY: robot.rotation.y,
    neckYaw: neck.rotation.y,
  };
  const pose = { ...SIT };

  let routineStart = 0;
  let waveStart = -Infinity;
  let nextWave = 12.5;
  let nextBlink = 2.5;

  // glancing at something (a toy being played with): target angles and when it started
  const look = { yaw: 0, nod: 0, until: -Infinity, weight: 0 };
  const _local = new THREE.Vector3();

  function blinkAmount(t) {
    const d = t - nextBlink;
    if (d < 0) return 0;
    if (d > 0.18) {
      nextBlink = t + 2.5 + Math.random() * 3;
      return 0;
    }
    return Math.sin((d / 0.18) * Math.PI);
  }

  function waveAmount(t) {
    const d = t - waveStart;
    if (d < 0 || d > WAVE_LEN) return { lift: 0, wiggle: 0 };
    let lift = 1;
    if (d < WAVE_RAISE) lift = smooth(d / WAVE_RAISE);
    else if (d > WAVE_RAISE + WAVE_HOLD) lift = smooth(1 - (d - WAVE_RAISE - WAVE_HOLD) / WAVE_LOWER);
    return { lift, wiggle: Math.sin(Math.max(0, d - WAVE_RAISE * 0.6) * Math.PI * 4.4) };
  }

  function routineTime(t) {
    return (((t - routineStart) % LOOP) + LOOP) % LOOP;
  }

  // a wave only fits while resting, and must be done before the rest ends
  function canWave(t) {
    const r = routineTime(t);
    const end = idleWindow(r);
    return end !== null && end - r > WAVE_LEN && t - waveStart > WAVE_LEN;
  }

  return {
    /** Height the hips are lifted to; the camera follows it a little. */
    get lift() {
      return hipLift(pose.leg) + pose.hop;
    },

    /** Turn the head towards a point in the world for a couple of seconds. */
    lookAt(point, t) {
      _local.copy(point);
      robot.worldToLocal(_local);
      const headY = neckY + 0.83;
      look.yaw = THREE.MathUtils.clamp(Math.atan2(_local.x, _local.z) - base.neckYaw, -0.55, 0.55);
      const down = Math.atan2(headY - _local.y, Math.hypot(_local.x, _local.z));
      look.nod = THREE.MathUtils.clamp(down * 0.45, -0.25, 0.3);
      look.until = t + 2.2;
    },

    /** How far a hop has taken the feet off the floor. */
    get air() {
      return pose.hop;
    },

    /** Tap: wave while resting, or have a go at standing up while sitting. */
    tap(t) {
      const r = routineTime(t);
      const sitting = r < START_TRY || r >= IDLE[2][0];
      if (sitting) routineStart = t - START_TRY;
      else if (canWave(t)) waveStart = t;
    },

    update(t, dt = 1 / 60) {
      const r = routineTime(t);
      poseAt(r, pose);

      // auto wave now and then while resting
      if (t >= nextWave) {
        if (canWave(t)) waveStart = t;
        nextWave = t + 6 + Math.random() * 4;
      }

      // whole robot: lift, wobble, squash
      const lift = hipLift(pose.leg) + pose.hop;
      robot.position.set(base.position.x, base.position.y + lift, base.position.z);
      robot.rotation.set(0, base.rotationY, pose.roll);
      const stretch = 1 / Math.sqrt(pose.squash);
      robot.scale.set(stretch, pose.squash, stretch);

      upper.rotation.x = pose.pitch;
      for (const hip of legs) hip.rotation.x = pose.leg;

      // arms: pose + a gentle sway, with the near arm blending into the wave
      const wave = waveAmount(t);
      for (const arm of arms) {
        const { side, rest } = arm.userData;
        let x = rest.x + pose.armX + Math.sin(t * 1.1 + side * 0.5) * 0.04;
        let z = side * (Math.abs(rest.z) + pose.armZ + Math.sin(t * 1.3 + side) * 0.06);
        if (side > 0) {
          z = THREE.MathUtils.lerp(z, 1.85 + wave.wiggle * 0.3, wave.lift);
          x = THREE.MathUtils.lerp(x, 0.35, wave.lift);
        }
        arm.rotation.set(x, 0, z);
      }

      // head: breathing bob, nods and shakes from the pose
      neck.position.y = neckY + Math.sin(t * 1.6) * 0.012;
      look.weight += ((t < look.until ? 1 : 0) - look.weight) * (1 - Math.exp(-dt * 6));
      neck.rotation.set(
        Math.sin(t * 0.6 + 1) * 0.02 + pose.nod + look.nod * look.weight,
        base.neckYaw + pose.turn + look.yaw * look.weight,
        Math.sin(t * 0.8) * 0.035 - wave.lift * 0.07,
      );

      antennae.forEach((a, i) => {
        // antennae lag behind the body's motion a little
        const jiggle = (pose.pitch + pose.roll * 2) * 0.25;
        a.rotation.z = (i ? -1 : 1) * (Math.sin(t * 2.4 + i) * 0.05) + jiggle * (i ? 1 : -1);
        a.rotation.x = -pose.pitch * 0.3;
      });

      const b = blinkAmount(t);
      for (const e of eyes) e.scale.y = 1 - 0.88 * b;

      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      barGlow.material.opacity = 0.15 + 0.15 * pulse;
      for (const ear of ears) ear.children[1].material.emissiveIntensity = 0.62 + 0.15 * pulse;
    },
  };
}
