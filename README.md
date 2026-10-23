# ex-threejs

Pastel robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

The robot starts sitting, then works its way up to standing like a toddler: it rocks to build momentum, pushes off the floor, plops back down on the first try and makes it on the second. After a while it sits back down and tries again.

Pastel toys sit around it: drag a block, the ball, the ring, the cone or the pill to move it (let go mid-swing to fling it), or tap one to make it hop and flip. Tap the star to spin it and the bubbles to pop them. The robot looks at whatever you play with.

Drag the background to orbit, scroll to zoom. Tap the robot while it sits to make it try to stand, or while it stands to make it wave. Add `?still` to the URL to show the static sitting pose.

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor, eyes, ear lights)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/animation.js` – stand-up routine, waving, blinking and other idle motion
- `src/toys.js` – the toys, their little physics and pointer interaction
- `src/main.js` – renderer, camera and lights
