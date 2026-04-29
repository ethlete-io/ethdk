// @ts-check
'use strict';

/**
 * Integration tests for the recommended TypeScript config.
 *
 * These tests verify that the rules wired inside `configs/recommended.js` behave
 * as expected when used through a real `Linter` instance with the full plugin
 * loaded — covering built-in rules, @typescript-eslint rules, and @angular-eslint
 * rules that are configured (not just custom rules).
 */

const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const angularEslint = require('@angular-eslint/eslint-plugin');
const plugin = require('../index');

/**
 * Returns all messages from linting `code` with the full recommended config.
 *
 * - Wraps the config in an array (required for flat-config `Linter#verify`).
 * - Passes `filename: 'test.ts'` so the `files: ['**\/*.ts']` pattern in the
 *   config matches and rules are applied.
 * - Registers `@typescript-eslint` and `@angular-eslint` plugins alongside
 *   `ethlete` so all referenced rules are resolvable.
 *
 * @param {string} code
 */
const lint = (code) => {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(
    code,
    [
      {
        ...plugin.configs.recommendedTs,
        plugins: {
          ...plugin.configs.recommendedTs.plugins,
          '@typescript-eslint': tsPlugin,
          '@angular-eslint': angularEslint,
        },
        languageOptions: {
          parser: tsParser,
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      },
    ],
    { filename: 'test.ts' },
  );
};

const ruleIds = (messages) => [...new Set(messages.map((m) => m.ruleId))];

// ── @typescript-eslint/consistent-type-definitions ──────────────────────────

test('consistent-type-definitions: interface is flagged', () => {
  const msgs = lint(`interface Foo { bar: string; }`);
  expect(ruleIds(msgs)).toContain('@typescript-eslint/consistent-type-definitions');
});

test('consistent-type-definitions: type is valid', () => {
  const msgs = lint(`type Foo = { bar: string; };`);
  expect(ruleIds(msgs)).not.toContain('@typescript-eslint/consistent-type-definitions');
});

// ── @typescript-eslint/no-explicit-any ──────────────────────────────────────

test('no-explicit-any: any is flagged', () => {
  const msgs = lint(`const x: any = 1;`);
  expect(ruleIds(msgs)).toContain('@typescript-eslint/no-explicit-any');
});

// ── no-var ───────────────────────────────────────────────────────────────────

test('no-var: var is flagged', () => {
  const msgs = lint(`var x = 1;`);
  expect(ruleIds(msgs)).toContain('no-var');
});

// ── prefer-const ─────────────────────────────────────────────────────────────

test('prefer-const: let that is never reassigned is flagged', () => {
  const msgs = lint(`let x = 1; console.log(x);`);
  expect(ruleIds(msgs)).toContain('prefer-const');
});

// ── one-var ───────────────────────────────────────────────────────────────────

test('one-var: multiple declarations in one statement are flagged', () => {
  const msgs = lint(`const x = 1, y = 2;`);
  expect(ruleIds(msgs)).toContain('one-var');
});

// ── eqeqeq ───────────────────────────────────────────────────────────────────

test('eqeqeq: == is flagged', () => {
  const msgs = lint(`if (x == null) {}`);
  expect(ruleIds(msgs)).toContain('eqeqeq');
});

// ── max-params ────────────────────────────────────────────────────────────────

test('max-params: more than 2 params is flagged', () => {
  const msgs = lint(`const fn = (a, b, c) => {};`);
  expect(ruleIds(msgs)).toContain('max-params');
});

test('max-params: 2 params is valid', () => {
  const msgs = lint(`const fn = (a, b) => {};`);
  expect(ruleIds(msgs)).not.toContain('max-params');
});

// ── no-restricted-syntax: enum ────────────────────────────────────────────────

test('no-restricted-syntax: enum is flagged', () => {
  const msgs = lint(`enum Color { Red, Green }`);
  expect(msgs.length).toBeGreaterThan(0);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('enum'))).toBe(true);
});

// ── no-restricted-syntax: async/await ─────────────────────────────────────────

test('no-restricted-syntax: async arrow is flagged', () => {
  const msgs = lint(`const fn = async () => {};`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('async'))).toBe(true);
});

// ── no-restricted-syntax: public keyword ──────────────────────────────────────

test('no-restricted-syntax: public method is flagged', () => {
  const msgs = lint(`class Foo { public doWork() {} }`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('public'))).toBe(true);
});

// ── no-restricted-syntax: static ──────────────────────────────────────────────

test('no-restricted-syntax: static property is flagged', () => {
  const msgs = lint(`class Foo { static bar = 1; }`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('static'))).toBe(true);
});

// ── no-restricted-syntax: # prefix ────────────────────────────────────────────

test('no-restricted-syntax: # private field is flagged', () => {
  const msgs = lint(`class Foo { #bar = 1; }`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('#'))).toBe(true);
});

// ── no-restricted-syntax: @Injectable ─────────────────────────────────────────

test('no-restricted-syntax: @Injectable decorator is flagged', () => {
  const msgs = lint(`@Injectable({ providedIn: 'root' })\nclass MyService {}`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('Injectable'))).toBe(true);
});

// ── no-restricted-syntax: barrel import ───────────────────────────────────────

test('no-restricted-syntax: barrel import is flagged', () => {
  const msgs = lint(`import { Foo } from './components/index';`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('barrel'))).toBe(true);
});

test('no-restricted-syntax: root index barrel import is flagged', () => {
  const msgs = lint(`import { Foo } from 'index';`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('barrel'))).toBe(true);
});

test('no-restricted-syntax: non-index import is valid', () => {
  const msgs = lint(`import { Foo } from './components/foo.component';`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('barrel'))).toBe(false);
});

// ── no-restricted-syntax: legacy lifecycle hooks ──────────────────────────────

test('no-restricted-syntax: ngOnChanges is flagged', () => {
  const msgs = lint(`class Foo { ngOnChanges() {} }`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('lifecycle'))).toBe(true);
});

test('no-restricted-syntax: ngAfterViewInit is flagged', () => {
  const msgs = lint(`class Foo { ngAfterViewInit() {} }`);
  expect(msgs.some((m) => m.ruleId === 'no-restricted-syntax' && m.message.includes('lifecycle'))).toBe(true);
});

// ── @angular-eslint/no-output-on-prefix ───────────────────────────────────────

test('no-output-on-prefix: output named onSelectDate is flagged', () => {
  const msgs = lint(`class Foo { onSelectDate = output(); }`);
  expect(ruleIds(msgs)).toContain('@angular-eslint/no-output-on-prefix');
});

test('no-output-on-prefix: output named selectDate is valid', () => {
  const msgs = lint(`class Foo { selectDate = output(); }`);
  expect(ruleIds(msgs)).not.toContain('@angular-eslint/no-output-on-prefix');
});

// ── @angular-eslint/prefer-on-push-component-change-detection ─────────────────

test('prefer-on-push: component without OnPush is flagged', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`);
  expect(ruleIds(msgs)).toContain('@angular-eslint/prefer-on-push-component-change-detection');
});

test('prefer-on-push: component with OnPush is valid', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None })
class MyCmp {}`);
  expect(ruleIds(msgs)).not.toContain('@angular-eslint/prefer-on-push-component-change-detection');
});

// ── ethlete/require-view-encapsulation-none ────────────────────────────────────

test('require-view-encapsulation-none: missing encapsulation is flagged', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MyCmp {}`);
  expect(ruleIds(msgs)).toContain('ethlete/require-view-encapsulation-none');
});

test('require-view-encapsulation-none: ViewEncapsulation.Emulated is flagged', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.Emulated })
class MyCmp {}`);
  expect(ruleIds(msgs)).toContain('ethlete/require-view-encapsulation-none');
});

test('require-view-encapsulation-none: ViewEncapsulation.None is valid', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None })
class MyCmp {}`);
  expect(ruleIds(msgs)).not.toContain('ethlete/require-view-encapsulation-none');
});

// ── ethlete/prefer-concise-angular-style-metadata ───────────────────────────

test('prefer-concise-angular-style-metadata: single-item styleUrls is flagged', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None, styleUrls: ['./my-cmp.css'] })
class MyCmp {}`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-concise-angular-style-metadata');
});

test('prefer-concise-angular-style-metadata: single-item styles array is flagged', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None, styles: [STYLES] })
class MyCmp {}`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-concise-angular-style-metadata');
});

test('prefer-concise-angular-style-metadata: concise style metadata is valid', () => {
  const msgs = lint(`
@Component({ selector: 'my-cmp', template: '', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.None, styleUrl: './my-cmp.css', styles: STYLES })
class MyCmp {}`);
  expect(ruleIds(msgs)).not.toContain('ethlete/prefer-concise-angular-style-metadata');
});

// ── ethlete/no-legacy-angular-decorators ─────────────────────────────────────

test('no-legacy-angular-decorators: @Input() is flagged', () => {
  const msgs = lint(`class Foo { @Input() value; }`);
  expect(ruleIds(msgs)).toContain('ethlete/no-legacy-angular-decorators');
});

test('no-legacy-angular-decorators: @Output() is flagged', () => {
  const msgs = lint(`class Foo { @Output() clicked = new EventEmitter(); }`);
  expect(ruleIds(msgs)).toContain('ethlete/no-legacy-angular-decorators');
});

test('no-legacy-angular-decorators: @ViewChild is flagged', () => {
  const msgs = lint(`class Foo { @ViewChild('ref') el; }`);
  expect(ruleIds(msgs)).toContain('ethlete/no-legacy-angular-decorators');
});

test('no-legacy-angular-decorators: @HostListener is flagged', () => {
  const msgs = lint(`class Foo { @HostListener('click') onClick() {} }`);
  expect(ruleIds(msgs)).toContain('ethlete/no-legacy-angular-decorators');
});

test('no-legacy-angular-decorators: @HostBinding is flagged', () => {
  const msgs = lint(`class Foo { @HostBinding('class.active') isActive = false; }`);
  expect(ruleIds(msgs)).toContain('ethlete/no-legacy-angular-decorators');
});

test('no-legacy-angular-decorators: two-way binding pair is flagged as useModel', () => {
  const msgs = lint(`class Foo { @Input() value = ''; @Output() valueChange = new EventEmitter(); }`);
  const modelErrors = msgs.filter(
    (m) => m.ruleId === 'ethlete/no-legacy-angular-decorators' && m.message.includes('model()'),
  );
  expect(modelErrors.length).toBe(2);
});

test('no-legacy-angular-decorators: signal-based input() is valid', () => {
  const msgs = lint(`class Foo { value = input(); }`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-legacy-angular-decorators');
});

// ── ethlete/no-angular-seo-services ──────────────────────────────────────────

test('no-angular-seo-services: inject(Title) is flagged', () => {
  const msgs = lint(`const title = inject(Title);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-seo-services');
});

test('no-angular-seo-services: inject(Meta) is flagged', () => {
  const msgs = lint(`const meta = inject(Meta);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-seo-services');
});

test('no-angular-seo-services: import Title from platform-browser is flagged', () => {
  const msgs = lint(`import { Title } from '@angular/platform-browser';`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-seo-services');
});

test('no-angular-seo-services: import Meta from platform-browser is flagged', () => {
  const msgs = lint(`import { Meta } from '@angular/platform-browser';`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-seo-services');
});

test('no-angular-seo-services: injectTitleBinding from ethlete/core is valid', () => {
  const msgs = lint(`import { injectTitleBinding } from '@ethlete/core';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-angular-seo-services');
});

test('no-angular-seo-services: other platform-browser imports are valid', () => {
  const msgs = lint(`import { DomSanitizer } from '@angular/platform-browser';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-angular-seo-services');
});

// ── ethlete/prefer-scroll-state (listeners) ───────────────────────────────────
test('prefer-scroll-state: addEventListener scroll is flagged', () => {
  const msgs = lint(`el.addEventListener('scroll', onScroll);`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-scroll-state');
});

test('prefer-scroll-state: fromEvent scroll is flagged', () => {
  const msgs = lint(`fromEvent(el, 'scroll').subscribe(fn);`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-scroll-state');
});

test('prefer-scroll-state: onscroll assignment is flagged', () => {
  const msgs = lint(`el.onscroll = onScroll;`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-scroll-state');
});

test('prefer-scroll-state: renderer.listen scroll is flagged', () => {
  const msgs = lint(`this.renderer.listen(el, 'scroll', onScroll);`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-scroll-state');
});

test('prefer-scroll-state: addEventListener click is valid', () => {
  const msgs = lint(`el.addEventListener('click', onClick);`);
  expect(ruleIds(msgs)).not.toContain('ethlete/prefer-scroll-state');
});

// ── ethlete/prefer-match-media (BreakpointObserver) ───────────────────────────
test('prefer-match-media: import BreakpointObserver from cdk is flagged', () => {
  const msgs = lint(`import { BreakpointObserver } from '@angular/cdk/layout';`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-match-media');
});

test('prefer-match-media: inject(BreakpointObserver) is flagged', () => {
  const msgs = lint(`const bo = inject(BreakpointObserver);`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-match-media');
});

test('prefer-match-media: window.matchMedia is flagged', () => {
  const msgs = lint(`window.matchMedia('(max-width: 768px)');`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-match-media');
});

test('prefer-match-media: injectBreakpointObserver from ethlete/core is valid', () => {
  const msgs = lint(`import { injectBreakpointObserver } from '@ethlete/core';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/prefer-match-media');
});

// ── ethlete/prefer-clone-equal ────────────────────────────────────────────────
test('prefer-clone-equal: JSON.parse(JSON.stringify()) is flagged', () => {
  const msgs = lint(`const copy = JSON.parse(JSON.stringify(obj));`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-clone-equal');
});

test('prefer-clone-equal: structuredClone is flagged', () => {
  const msgs = lint(`const copy = structuredClone(obj);`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-clone-equal');
});

test('prefer-clone-equal: lodash cloneDeep import is flagged', () => {
  const msgs = lint(`import { cloneDeep } from 'lodash';`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-clone-equal');
});

test('prefer-clone-equal: lodash isEqual import is flagged', () => {
  const msgs = lint(`import { isEqual } from 'lodash';`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-clone-equal');
});

test('prefer-clone-equal: lodash/isEqual default import is flagged', () => {
  const msgs = lint(`import isEqual from 'lodash/isEqual';`);
  expect(ruleIds(msgs)).toContain('ethlete/prefer-clone-equal');
});

test('prefer-clone-equal: clone/equal from @ethlete/core is valid', () => {
  const msgs = lint(`import { clone, equal } from '@ethlete/core';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/prefer-clone-equal');
});

// ── ethlete/no-document-cookie ────────────────────────────────────────────────
test('no-document-cookie: document.cookie read is flagged', () => {
  const msgs = lint(`const raw = document.cookie;`);
  expect(ruleIds(msgs)).toContain('ethlete/no-document-cookie');
});

test('no-document-cookie: document.cookie write is flagged', () => {
  const msgs = lint(`document.cookie = 'name=value';`);
  expect(ruleIds(msgs)).toContain('ethlete/no-document-cookie');
});

test('no-document-cookie: setCookie from @ethlete/core is valid', () => {
  const msgs = lint(`import { setCookie } from '@ethlete/core'; setCookie('name', 'value');`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-document-cookie');
});

// ── ethlete/no-angular-router-api ─────────────────────────────────────────────
test('no-angular-router-api: import ActivatedRoute is flagged', () => {
  const msgs = lint(`import { ActivatedRoute } from '@angular/router';`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: inject(ActivatedRoute) is flagged', () => {
  const msgs = lint(`const route = inject(ActivatedRoute);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: inject(Router) alone is valid', () => {
  const msgs = lint(`const router = inject(Router);`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: router.url access is flagged', () => {
  const msgs = lint(`const router = inject(Router); const u = router.url;`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: router.events access is flagged', () => {
  const msgs = lint(`const router = inject(Router); router.events.subscribe(fn);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: injectUrl from @ethlete/core is valid', () => {
  const msgs = lint(`import { injectUrl, injectQueryParam } from '@ethlete/core';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-angular-router-api');
});

test('no-angular-router-api: other @angular/router imports are valid', () => {
  const msgs = lint(`import { RouterLink, RouterOutlet } from '@angular/router';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-angular-router-api');
});

// ── ethlete/no-window-location ────────────────────────────────────────────────
test('no-window-location: window.location.pathname is flagged', () => {
  const msgs = lint(`const path = window.location.pathname;`);
  expect(ruleIds(msgs)).toContain('ethlete/no-window-location');
});

test('no-window-location: window.location.search is flagged', () => {
  const msgs = lint(`const search = window.location.search;`);
  expect(ruleIds(msgs)).toContain('ethlete/no-window-location');
});

test('no-window-location: new URLSearchParams(window.location.search) is flagged', () => {
  const msgs = lint(`const p = new URLSearchParams(window.location.search);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-window-location');
});

test('no-window-location: window.location.href redirect (assignment) is valid', () => {
  const msgs = lint(`window.location.href = 'https://example.com';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-window-location');
});

test('no-window-location: injectRoute from @ethlete/core is valid', () => {
  const msgs = lint(`import { injectRoute } from '@ethlete/core';`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-window-location');
});

// ── ethlete/no-locale-id ──────────────────────────────────────────────────────
test('no-locale-id: import LOCALE_ID from @angular/core is flagged', () => {
  const msgs = lint(`import { LOCALE_ID } from '@angular/core';`);
  expect(ruleIds(msgs)).toContain('ethlete/no-locale-id');
});

test('no-locale-id: inject(LOCALE_ID) is flagged', () => {
  const msgs = lint(`const locale = inject(LOCALE_ID);`);
  expect(ruleIds(msgs)).toContain('ethlete/no-locale-id');
});

test('no-locale-id: injectLocale from @ethlete/core is valid', () => {
  const msgs = lint(`import { injectLocale } from '@ethlete/core'; const l = injectLocale();`);
  expect(ruleIds(msgs)).not.toContain('ethlete/no-locale-id');
});
