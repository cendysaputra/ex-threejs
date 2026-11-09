import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        witchHat: resolve(import.meta.dirname, 'witch-hat/index.html'),
        pastelRobot: resolve(import.meta.dirname, 'backup/pastel-robot/index.html'),
        pinkRobot: resolve(import.meta.dirname, 'backup/pink-robot/index.html'),
      },
    },
  },
});
