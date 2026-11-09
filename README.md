# ex-threejs

Pastel robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

The robot starts sitting, then works its way up to standing like a toddler: it rocks to build momentum, pushes off the floor, plops back down on the first try and makes it on the second. After a while it sits back down and tries again.

Pastel toys lie on the floor around it: blocks, a beach ball, a ring, a cone, a pill, a star and a few marbles. Drag one to move it (let go mid-swing to fling it) or tap it to make it hop and flip; the round ones roll. Everything sits on a pastel polka-dot floor that fills the screen and fades into the background in the distance, and casts a soft drop shadow on it. The robot looks at whatever you play with.

The scene fills the window and browser zoom is disabled (ctrl/cmd + 0 still resets it). Drag the background to orbit around the robot or up over it (the camera never drops below the starting view), scroll or pinch to zoom. Tap the robot while it sits to make it try to stand, or while it stands to make it wave. Add `?still` to the URL to show the static sitting pose.

Earlier robots are kept as self-contained copies: the pastel robot in `backup/pastel-robot/` (served at `/backup/pastel-robot/`) and the white-and-pink robot in `backup/pink-robot/` (served at `/backup/pink-robot/`).

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor, eyes, ear lights)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/animation.js` – stand-up routine, waving, blinking and other idle motion
- `src/toys.js` – the toys, their little physics and pointer interaction
- `src/main.js` – renderer, camera and lights

## Witch Hat

The **Witch Hat** project menu opens a separate page at `/witch-hat/`. The robot
scene and both robot backups keep their own entry points.

The hat is modeled in Three.js, with a waving brim, a bent crown, an integrated
purple eye, gold embroidery, a crescent and a swinging crystal. Its cloth and gold use custom anime paint ramps, thin ink contours and sculpted
creases. The iris uses painted highlights; the crystal uses the shared studio
environment. No model
downloads or external image assets are needed.

- Drag to orbit; scroll or pinch to zoom. **Reset** restores the initial camera.
- The eye blinks automatically and follows the pointer. **Berkedip** triggers a
  blink; tapping the hat also gives it a little magical sway.
- **Jeda animasi** pauses motion. Reduced-motion preferences start it paused.
  `/witch-hat/?still` opens a static pose for inspection.
- `src/witch-hat/model.js` builds geometry, ornaments and morphing cloth lids.
- `iris.js` paints the eye and projects it beneath the moving cloth eyelids.
- `animation.js` drives blinking, gaze, floating, crown motion and the pendant.
- `effects.js` supplies a soft contact shadow and sparse drifting particles.
- `main.js` manages the renderer, studio lights, camera and input.

`npm run build` includes all four pages through the Vite multi-page configuration.

The crown is lofted between asymmetric silhouette curves rather than swept as a
circular tube. `anime-material.js` controls its shadow, midtone and light colors.
