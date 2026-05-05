// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./require-view-encapsulation-none');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('require-view-encapsulation-none', rule, {
  valid: [
    {
      code: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
    },
    {
      code: `
@Directive({ selector: '[myDir]' })
class MyDir {}`,
    },
    {
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {}`,
    },
  ],
  invalid: [
    {
      code: `
import { Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`,
      output: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
import { Component } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.Emulated })
class MyCmp {}`,
      output: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
      errors: [{ messageId: 'notNone' }],
    },
    {
      code: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.ShadowDom })
class MyCmp {}`,
      output: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
      errors: [{ messageId: 'notNone' }],
    },
    {
      code: `
import { Component } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MyCmp {}`,
      output: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
import { Component } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
})
class MyCmp {}`,
      output: `
import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'my-cmp',
  template: '',
  encapsulation: ViewEncapsulation.None
})
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`,
      output: `import { ViewEncapsulation } from '@angular/core';

@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
  ],
});
