const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['gui/renderer.js'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: 'gui/dist/renderer.js',
  sourcemap: true,
  target: ['chrome114'], // match your Electron version
  logLevel: 'info',
}).catch(() => process.exit(1));
