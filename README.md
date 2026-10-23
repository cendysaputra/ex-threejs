# ex-threejs

A white-and-pink robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

The robot stands on a pastel polka-dot floor, says hi with its raised hand every few seconds, squints its happy eyes and bobs gently. Tap it to make it hop and wave.

Pastel toys lie on the floor around it: blocks, a beach ball, a ring, a cone, a pill, a star and a few marbles. Drag one to move it (let go mid-swing to fling it) or tap it to make it hop and flip; the round ones roll. Everything casts a soft drop shadow, and the robot looks at whatever you play with.

The scene fills the window and browser zoom is disabled (ctrl/cmd + 0 still resets it). Drag the background to orbit around the robot or up over it (the camera never drops below the starting view), scroll or pinch to zoom. Add `?still` to the URL to show the static pose.

The previous pastel robot is kept in `backup/pastel-robot/` and served at `/backup/pastel-robot/`.

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor glass and glow, floor, toys)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/animation.js` – waving, hopping, squinting, glancing at toys and other idle motion
- `src/toys.js` – the toys, their little physics and pointer interaction
- `src/main.js` – renderer, camera and lights
