import { build } from 'esbuild';

/**
 * Bundles the VS Code extension into the one CommonJS file its manifest points at.
 *
 * `vscode` is external because the editor provides it at runtime and it exists on no registry, and the
 * output is CommonJS because that is the only module format the extension host loads.
 */
await build({
  entryPoints: ['apps/timetrack-vscode/src/extension.ts'],
  outfile: 'apps/timetrack-vscode/dist/extension.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  minify: true,
  sourcemap: true,
  tsconfig: 'apps/timetrack-vscode/tsconfig.app.json',
  logLevel: 'info',
});
