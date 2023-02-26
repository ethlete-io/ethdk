module.exports = {
  core: { builder: 'webpack5' },
  stories: [
    '../src/app/**/*.stories.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/**/*.stories.mdx',
    '../../../libs/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-controls',
    '@storybook/addon-a11y',
    '@storybook/addon-actions',
    '@storybook/addon-viewport',
    'storybook-addon-designs',
    'storybook-dark-mode',
  ],
};
