# ex-threejs

Pastel robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

The robot starts sitting, then works its way up to standing like a toddler: it rocks to build momentum, pushes off the floor, plops back down on the first try and makes it on the second. After a while it sits back down and tries again.

Drag to orbit, scroll to zoom. Tap while it sits to make it try to stand, or while it stands to make it wave. Add `?still` to the URL to show the static sitting pose.

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor, eyes, ear lights)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/animation.js` – stand-up routine, waving, blinking and other idle motion
- `src/main.js` – renderer, camera and lights
