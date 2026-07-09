// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-redundant-on-push-change-detection');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// ── Angular >= 22: the rule is active ────────────────────────────────────────
// The installed workspace Angular is >= 22, so no settings override is needed
// here — auto-detection already enables the rule.

tester.run('no-redundant-on-push-change-detection (angular 22)', rule, {
  valid: [
    // Nothing to strip.
    {
      code: `@Component({ selector: 'et-x', template: '' }) class Foo {}`,
    },
    // A non-default strategy is intentional and must stay.
    {
      code: `import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({ selector: 'et-x', template: '', changeDetection: ChangeDetectionStrategy.Default }) class Foo {}`,
    },
    // Import is still needed for a non-changeDetection usage — keep it.
    {
      code: `import { ChangeDetectionStrategy, Component } from '@angular/core';
const strat = ChangeDetectionStrategy.OnPush;
@Component({ selector: 'et-x', template: '' }) class Foo {}`,
    },
  ],
  invalid: [
    // Inline, last property + inline import (specifier last).
    {
      code: `import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({ selector: 'et-x', template: '', changeDetection: ChangeDetectionStrategy.OnPush }) class Foo {}`,
      output: `import { Component } from '@angular/core';
@Component({ selector: 'et-x', template: '' }) class Foo {}`,
      errors: [{ messageId: 'redundantImport' }, { messageId: 'redundant' }],
    },
    // Inline, middle property + inline import (specifier first).
    {
      code: `import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
@Component({ selector: 'et-x', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None }) class Foo {}`,
      output: `import { Component, ViewEncapsulation } from '@angular/core';
@Component({ selector: 'et-x', template: '', encapsulation: ViewEncapsulation.None }) class Foo {}`,
      errors: [{ messageId: 'redundantImport' }, { messageId: 'redundant' }],
    },
    // Multiline metadata + multiline import (own-line specifier).
    {
      code: `import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
@Component({
  selector: 'et-x',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Foo {}`,
      output: `import {
  Component,
} from '@angular/core';
@Component({
  selector: 'et-x',
  template: '',
})
class Foo {}`,
      errors: [{ messageId: 'redundantImport' }, { messageId: 'redundant' }],
    },
    // Multiple components sharing one import — every property removed, import removed once.
    {
      code: `import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({ selector: 'et-a', template: '', changeDetection: ChangeDetectionStrategy.OnPush }) class A {}
@Component({ selector: 'et-b', template: '', changeDetection: ChangeDetectionStrategy.OnPush }) class B {}`,
      output: `import { Component } from '@angular/core';
@Component({ selector: 'et-a', template: '' }) class A {}
@Component({ selector: 'et-b', template: '' }) class B {}`,
      errors: [{ messageId: 'redundantImport' }, { messageId: 'redundant' }, { messageId: 'redundant' }],
    },
  ],
});

// ── Angular < 22: the rule is inert ──────────────────────────────────────────
// `settings.ethlete.angularMajor` pins the version below 22, so redundant
// OnPush must NOT be reported (removing it there would change behaviour).

tester.run('no-redundant-on-push-change-detection (angular 21 — inert)', rule, {
  valid: [
    {
      code: `import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({ selector: 'et-x', template: '', changeDetection: ChangeDetectionStrategy.OnPush }) class Foo {}`,
      settings: { ethlete: { angularMajor: 21 } },
    },
  ],
  invalid: [],
});
