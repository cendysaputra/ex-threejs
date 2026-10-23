# ex-threejs

Pastel robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

The robot starts sitting, then works its way up to standing like a toddler: it rocks to build momentum, pushes off the floor, plops back down on the first try and makes it on the second. After a while it sits back down and tries again.

Pastel toys lie on the floor around it: blocks, a beach ball, a ring, a cone, a pill, a star and a few marbles. Drag one to move it (let go mid-swing to fling it) or tap it to make it hop and flip; the round ones roll. Everything sits on a round pastel play mat and casts a soft drop shadow on it; the floor fades into the background in the distance. The robot looks at whatever you play with.

The canvas is 1200px wide (full width on narrower screens). Drag the background to orbit around the robot or up over it (the camera never drops below the starting view), scroll or pinch to zoom. Tap the robot while it sits to make it try to stand, or while it stands to make it wave. Add `?still` to the URL to show the static sitting pose.

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor, eyes, ear lights)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/animation.js` – stand-up routine, waving, blinking and other idle motion
- `src/toys.js` – the toys, their little physics and pointer interaction
- `src/main.js` – renderer, camera and lights
