import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Idle life for the standing robot: it breathes and shifts its weight, waves
// with its raised hand every few seconds, squints its happy eyes, and glances
// at whatever toy is being played with. A tap makes it hop and wave.
// ---------------------------------------------------------------------------

// The pose from the reference picture: right arm hanging, left hand up saying hi.
const POSE = {
  right: { arm: new THREE.Euler(-0.1, 0, -0.55), elbow: new THREE.Euler(-0.45, 0, 0.32) },
  left: { arm: new THREE.Euler(-1.05, -0.75, 0.95), elbow: new THREE.Euler(-0.6, 0, 0.3) },
  neck: new THREE.Euler(0.02, -0.08, 0.1),
};

const WAVE_LEN = 1.8; // seconds of waving per burst
const HOP_LEN = 0.5;
const HOP_HEIGHT = 0.16;

const smooth = (x) => x * x * (3 - 2 * x);

export function createAnimator(robot) {
  const { body, neck, eyes, arms, glow } = robot.userData;
  const neonBase = glow.neon.color.clone();
  const base = { y: robot.position.y, rotationY: robot.rotation.y };

  let waveStart = -Infinity;
  let nextWave = 1.2;
  let hopStart = -Infinity;
  let squintStart = -Infinity;
  let nextSquint = 3;
  let hop = 0;

  // glancing at something (a toy being played with)
  const look = { yaw: 0, nod: 0, until: -Infinity, weight: 0 };
  const _local = new THREE.Vector3();

  function applyPose() {
    arms.right.arm.rotation.copy(POSE.right.arm);
    arms.right.elbow.rotation.copy(POSE.right.elbow);
    arms.left.arm.rotation.copy(POSE.left.arm);
    arms.left.elbow.rotation.copy(POSE.left.elbow);
    neck.rotation.copy(POSE.neck);
  }
  applyPose();

  function wave(t) {
    const d = t - waveStart;
    if (d < 0 || d > WAVE_LEN) return 0;
    // ease in and out of the burst
    return Math.min(1, d / 0.25, (WAVE_LEN - d) / 0.35);
  }

  return {
    /** Height the camera should follow; the robot already stands, so none. */
    get lift() {
      return 0;
    },

    /** How far a hop has taken the feet off the floor. */
    get air() {
      return hop;
    },

    /** Turn the head towards a point in the world for a couple of seconds. */
    lookAt(point, t) {
      _local.copy(point);
      robot.worldToLocal(_local);
      const headY = neck.position.y + 0.77;
      look.yaw = THREE.MathUtils.clamp(Math.atan2(_local.x, _local.z), -0.6, 0.6);
      const down = Math.atan2(headY - _local.y, Math.hypot(_local.x, _local.z));
      look.nod = THREE.MathUtils.clamp(down * 0.45, -0.25, 0.32);
      look.until = t + 2.2;
    },

    /** Tap on the robot: a happy hop and a wave. */
    tap(t) {
      if (t - hopStart > HOP_LEN + 0.2) hopStart = t;
      waveStart = t;
      squintStart = t + 0.1;
    },

    update(t, dt = 1 / 60) {
      // waves now and then on its own
      if (t >= nextWave) {
        if (t - waveStart > WAVE_LEN) waveStart = t;
        nextWave = t + 4 + Math.random() * 3;
      }

      // hop with a squash on take-off and landing
      const h = (t - hopStart) / HOP_LEN;
      hop = h >= 0 && h <= 1 ? HOP_HEIGHT * 4 * h * (1 - h) : 0;
      const land = h > 1 && h < 1.5 ? Math.sin(((h - 1) / 0.5) * Math.PI) : 0;
      const takeoff = h >= 0 && h < 0.15 ? Math.sin((h / 0.15) * Math.PI) : 0;
      const squash = 1 - 0.06 * land - 0.04 * takeoff + Math.sin(t * 2.1) * 0.006;
      robot.position.y = base.y + hop;
      robot.rotation.set(0, base.rotationY, Math.sin(t * 0.9) * 0.018);
      body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

      // arms: the raised hand waves, the other one swings a little
      const w = wave(t);
      const left = arms.left;
      left.arm.rotation.set(
        POSE.left.arm.x,
        POSE.left.arm.y,
        POSE.left.arm.z + Math.sin(t * 1.3) * 0.03 + w * 0.12,
      );
      left.elbow.rotation.set(
        POSE.left.elbow.x,
        POSE.left.elbow.y,
        POSE.left.elbow.z + Math.sin(t * 2.0) * 0.04 + w * Math.sin(t * 9) * 0.32,
      );
      left.hand.rotation.z = w * Math.sin(t * 9 - 0.6) * 0.2;
      const right = arms.right;
      right.arm.rotation.set(
        POSE.right.arm.x + Math.sin(t * 1.1) * 0.04,
        POSE.right.arm.y,
        POSE.right.arm.z - Math.sin(t * 1.3 + 1) * 0.04 - hop * 1.2,
      );

      // head: a gentle bob and tilt, leaning into the wave, glancing at toys
      look.weight += ((t < look.until ? 1 : 0) - look.weight) * (1 - Math.exp(-dt * 6));
      neck.rotation.set(
        POSE.neck.x + Math.sin(t * 0.7 + 1) * 0.025 + look.nod * look.weight,
        POSE.neck.y + Math.sin(t * 0.45) * 0.05 + look.yaw * look.weight,
        POSE.neck.z + Math.sin(t * 0.8) * 0.03 - w * 0.06,
      );

      // happy squint now and then
      if (t >= nextSquint) {
        squintStart = t;
        nextSquint = t + 3 + Math.random() * 3;
      }
      const sq = (t - squintStart) / 0.35;
      const squint = sq >= 0 && sq <= 1 ? Math.sin(sq * Math.PI) : 0;
      for (const e of eyes) e.scale.set(1 + squint * 0.08, 1 - squint * 0.45, 1);

      // neon ring and chest light breathe
      const pulse = 0.93 + 0.07 * Math.sin(t * 2.2);
      glow.neon.color.copy(neonBase).multiplyScalar(pulse);
    },
  };
}
