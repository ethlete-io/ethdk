import type { StorybookConfig } from '@storybook/angular';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: [
    '../src/app/**/*-page.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/**/*-page.mdx',
    '../../../libs/**/*.stories.@(js|jsx|ts|tsx)',
  ],

  addons: [getAbsolutePath('@storybook/addon-a11y'), getAbsolutePath('@storybook/addon-docs')],

  framework: {
    name: getAbsolutePath('@storybook/angular'),
    options: {},
  },
};

export default config;

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
