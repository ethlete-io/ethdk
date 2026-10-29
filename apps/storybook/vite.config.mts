import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  plugins: [nxReadySignal()],
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/storybook',
  resolve: { tsconfigPaths: true },
}));
