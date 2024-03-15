import type { StorybookConfig } from '@storybook/angular';
import { dirname, join } from 'path';

const config: StorybookConfig = {
  stories: [
    '../src/app/**/*-page.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/**/*-page.mdx',
    '../../../libs/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('storybook-dark-mode'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/angular'),
    options: {},
  },
  docs: {
    autodocs: true,
  },
};

export default config;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
