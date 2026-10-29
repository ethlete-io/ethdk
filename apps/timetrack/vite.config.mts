import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/timetrack',
  plugins: [angular(), nxReadySignal()],
  resolve: { tsconfigPaths: true },
}));
