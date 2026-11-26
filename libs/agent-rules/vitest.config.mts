import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { specWorkers } from '../../tools/vitest/workers.mjs';

export default defineConfig({
  // Vite's OxcOptions type omits `tsconfig`. Without `false` the transform follows content/mods/plugins/*/tsconfig.json
  // to a `.claude-plugin/types` dir that only Claude Code generates, so CI cannot load it.
  oxc: { tsconfig: false } as ViteUserConfig['oxc'],
  test: {
    name: 'agent-rules',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['../../tools/vitest/spec-tmp.setup.mjs', './vitest.setup.ts'],
    reporters: ['default'],
    maxWorkers: specWorkers,
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-rules',
      provider: 'v8',
    },
  },
});
