import { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/design/**/*.stories.@(js|ts)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/angular',
    options: {
      builder: {
        viteConfigPath: 'apps/timetrack/vite.config.mts',
      },
    },
  },
};

export default config;
