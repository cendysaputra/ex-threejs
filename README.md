# ex-threejs

Pastel robot built with three.js, modeled entirely in code (no external models or textures).

```bash
npm install
npm run dev
```

Drag to orbit, scroll to zoom. Add `?still` to the URL to disable the idle animation.

- `src/robot.js` – robot geometry and materials
- `src/textures.js` – canvas textures (visor, eyes, ear lights)
- `src/environment.js` – soft pastel studio environment for reflections
- `src/main.js` – renderer, camera, lights and idle animation
