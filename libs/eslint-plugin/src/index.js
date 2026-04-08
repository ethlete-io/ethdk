// @ts-check
'use strict';

const noInjectChain = require('./rules/no-inject-chain');
const noTrivialReturnType = require('./rules/no-trivial-return-type');
const { recommendedTs, recommendedTemplate } = require('./configs/recommended');

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-ethlete',
    version: '0.0.1',
  },
  rules: {
    'no-inject-chain': noInjectChain,
    'no-trivial-return-type': noTrivialReturnType,
  },
};

// Inject the plugin reference into the configs so consumers don't have to
/** @type {import('eslint').Linter.Config} */
const recommendedTsWithPlugin = {
  ...recommendedTs,
  plugins: { ethlete: plugin },
};

/** @type {import('eslint').Linter.Config} */
const recommendedTemplateWithPlugin = {
  ...recommendedTemplate,
};

const configs = {
  /** TypeScript rules (merged into a files: ['**\/*.ts'] block) */
  recommendedTs: recommendedTsWithPlugin,
  /** Angular template rules (merged into a files: ['**\/*.html'] block) */
  recommendedTemplate: recommendedTemplateWithPlugin,
  /**
   * Both together as a flat array — the most common usage:
   *   export default [...baseConfig, ...ethlete.configs.recommended]
   */
  recommended: [recommendedTsWithPlugin, recommendedTemplateWithPlugin],
};

const ethletePlugin = { ...plugin, configs };

module.exports = ethletePlugin;
module.exports.plugin = ethletePlugin;
