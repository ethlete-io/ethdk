import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: [
    '../src/app/**/*-page.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/**/*-page.mdx',
    '../../../libs/**/*.docs.mdx',
    '../../../libs/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  staticDirs: [
    {
      from: '../src/assets',
      to: '/assets',
    },
  ],
  framework: {
    name: '@storybook/angular',
    options: {
      builder: {
        viteConfigPath: 'apps/playground/vite.config.mts',
      },
    },
  },
};

export default config;
