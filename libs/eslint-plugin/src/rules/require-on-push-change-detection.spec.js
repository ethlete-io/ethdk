// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./require-on-push-change-detection');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('require-on-push-change-detection', rule, {
  valid: [
    {
      code: `
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MyCmp {}`,
    },
    {
      code: `
@Directive({ selector: '[myDir]' })
class MyDir {}`,
    },
  ],
  invalid: [
    {
      code: `
import { Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`,
      output: `
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
import { Component } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
  encapsulation: ViewEncapsulation.None,
})
class MyCmp {}`,
      output: `
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.Default })
class MyCmp {}`,
      output: `
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MyCmp {}`,
      errors: [{ messageId: 'notOnPush' }],
    },
    {
      code: `
@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`,
      output: `import { ChangeDetectionStrategy } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
  ],
});
