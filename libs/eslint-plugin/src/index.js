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
const noTypeOnlyImport = require('./rules/no-type-only-import');
const guardReturnNewline = require('./rules/guard-return-newline');
const noSubscribeWithBody = require('./rules/no-subscribe-with-body');
const requireDollarSuffix = require('./rules/require-dollar-suffix');
const noPipeLogic = require('./rules/no-pipe-logic');
const enforceRoutingViewNaming = require('./rules/enforce-routing-view-naming');
const requireViewEncapsulationNone = require('./rules/require-view-encapsulation-none');
const noLegacyAngularDecorators = require('./rules/no-legacy-angular-decorators');
const noAngularSeoServices = require('./rules/no-angular-seo-services');
const preferCloneEqual = require('./rules/prefer-clone-equal');
const noDocumentCookie = require('./rules/no-document-cookie');
const noAngularRouterApi = require('./rules/no-angular-router-api');
const noWindowLocation = require('./rules/no-window-location');
const noLocaleId = require('./rules/no-locale-id');
const noMemberAlias = require('./rules/no-member-alias');
const noUnusedClassMember = require('./rules/no-unused-class-member');
const noDomQuery = require('./rules/no-dom-query');
const { recommendedTs, recommendedTemplate } = require('./configs/recommended');

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: '@ethlete/eslint-plugin',
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
    'no-type-only-import': noTypeOnlyImport,
    'guard-return-newline': guardReturnNewline,
    'no-subscribe-with-body': noSubscribeWithBody,
    'require-dollar-suffix': requireDollarSuffix,
    'no-pipe-logic': noPipeLogic,
    'enforce-routing-view-naming': enforceRoutingViewNaming,
    'require-view-encapsulation-none': requireViewEncapsulationNone,
    'no-legacy-angular-decorators': noLegacyAngularDecorators,
    'no-angular-seo-services': noAngularSeoServices,
    'prefer-clone-equal': preferCloneEqual,
    'no-document-cookie': noDocumentCookie,
    'no-angular-router-api': noAngularRouterApi,
    'no-window-location': noWindowLocation,
    'no-locale-id': noLocaleId,
    'no-member-alias': noMemberAlias,
    'no-unused-class-member': noUnusedClassMember,
    'no-dom-query': noDomQuery,
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
