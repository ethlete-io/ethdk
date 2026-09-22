import type { StorybookConfig } from '@analogjs/storybook-angular';
import { mergeConfig } from 'vite';

// Without groups, rolldown emits one chunk per shared module (~180 requests per story). The Angular
// JIT plugin also names inline-style modules after their base64 content, which exceeds the file
// system's name limit as a chunk file name, so those have to land in a named group too.
const sharedChunkName = (id: string) => {
  if (id.includes('/node_modules/')) return 'vendor';
  if (id.includes('_virtual_angular_jit')) return 'jit-styles';
  if (/\.(stories\.ts|mdx)$/.test(id)) return null;
  return id.match(/\/libs\/([^/]+)\//)?.[1] ?? null;
};

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*-page.mdx',
    '../src/stories/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/**/*-page.mdx',
    '../../../libs/**/*.docs.mdx',
    '../../../libs/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-vitest'],
  staticDirs: [
    {
      from: '../src/assets',
      to: '/assets',
    },
  ],
  framework: {
    name: '@analogjs/storybook-angular',
    options: {
      builder: {
        viteConfigPath: 'apps/storybook/vite.config.mts',
      },
    },
  },
  // The builder ignores `build` in vite.config.mts, so it has to be set here.
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      build: {
        // The minifier rewrites custom property values (`0.16` → `.16`), which storybook-e2e reads verbatim.
        cssMinify: false,
        rolldownOptions: {
          output: {
            codeSplitting: { groups: [{ name: sharedChunkName }] },
          },
        },
      },
    }),
};

export default config;
