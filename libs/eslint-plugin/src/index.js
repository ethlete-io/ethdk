// @ts-check
'use strict';

const noInjectChain = require('./rules/no-inject-chain');
const noTrivialReturnType = require('./rules/no-trivial-return-type');
const noSubscribeInPipe = require('./rules/no-subscribe-in-pipe');
const noRxjsInEffect = require('./rules/no-rxjs-in-effect');
const noReadonlySignal = require('./rules/no-readonly-signal');
const noScreamingCaseLocal = require('./rules/no-screaming-case-local');
const preferRxjsTimer = require('./rules/prefer-rxjs-timer');
const preferLinkedSignal = require('./rules/prefer-linked-signal');
const noTrivialWrapperMethod = require('./rules/no-trivial-wrapper-method');
const noDirectDomManipulation = require('./rules/no-direct-dom-manipulation');
const noNativeObservers = require('./rules/no-native-observers');
const preferViewportSize = require('./rules/prefer-viewport-size');
const preferMatchMedia = require('./rules/prefer-match-media');
const preferElementDimensions = require('./rules/prefer-element-dimensions');
const preferScrollState = require('./rules/prefer-scroll-state');
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
    'no-subscribe-in-pipe': noSubscribeInPipe,
    'no-rxjs-in-effect': noRxjsInEffect,
    'no-readonly-signal': noReadonlySignal,
    'no-screaming-case-local': noScreamingCaseLocal,
    'prefer-rxjs-timer': preferRxjsTimer,
    'prefer-linked-signal': preferLinkedSignal,
    'no-trivial-wrapper-method': noTrivialWrapperMethod,
    'no-direct-dom-manipulation': noDirectDomManipulation,
    'no-native-observers': noNativeObservers,
    'prefer-viewport-size': preferViewportSize,
    'prefer-match-media': preferMatchMedia,
    'prefer-element-dimensions': preferElementDimensions,
    'prefer-scroll-state': preferScrollState,
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
