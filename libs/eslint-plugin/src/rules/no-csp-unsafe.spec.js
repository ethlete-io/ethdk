// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('./no-csp-unsafe');

const tsTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const templateTester = new RuleTester({
  languageOptions: { parser: /** @type {any} */ (templateParser) },
});

tsTester.run('no-csp-unsafe', rule, {
  valid: [
    { code: `el.style.color = 'red';` },
    { code: `el.style.setProperty('--x', '1');` },
    { code: `el.setAttribute('data-align', 'center');` },
    { code: `renderer.setAttribute(el, 'class', 'x');` },
    { code: `renderer.setAttributes(el, { type: 'button' });` },
    { code: `const style = el.getAttribute('style');` },
    {
      code: `const create = (nonce) => { const s = document.createElement('style'); s.setAttribute('nonce', nonce); return s; };`,
    },
    {
      code: `const create = (nonce) => { const s = document.createElement('script'); if (nonce) s.nonce = nonce; return s; };`,
    },
    {
      code: `const load = () => { const s = renderer.createElement('script'); renderer.setAttribute(s, 'nonce', nonce); };`,
    },
    {
      code: `const load = () => { const s = renderer.createElement('script'); renderer.setAttributes(s, { type: 'application/ld+json', nonce }); };`,
    },
    {
      code: `class A { mount() { this.el = document.createElement('style'); this.el.nonce = this.nonce; } }`,
    },
    { code: `const d = document.createElement('div');` },
    { code: `setTimeout(() => tick(), 10);` },
    { code: `setInterval(tick, 10);` },
    { code: `const eval = (x) => x; eval('1');` },
    { code: `const Function = class {}; new Function();` },
    { code: `const html = '<div class="et-align-center">x</div>';` },
    { code: 'const html = `<p data-align="${align}">${inner}</p>`;' },
    { code: `const html = '<svg><text font-style="italic">I</text></svg>';` },
    { code: `const text = 'set style="color: red" on it';` },
    { code: `/** <div style="color: red"></div> */ const x = 1;` },
    { code: `// el.setAttribute('style', 'x')\nconst x = 1;` },
    {
      code: `@Component({ selector: 'x', template: '<div style="color: red"></div>' }) class A {}`,
    },
    {
      code: `@Component({ selector: 'x', host: { class: 'x', '[style.color]': 'color()' } }) class A {}`,
    },
  ],
  invalid: [
    {
      code: `el.setAttribute('style', 'color: red');`,
      errors: [{ messageId: 'styleAttribute' }],
    },
    {
      code: `renderer.setAttribute(el, 'style', css);`,
      errors: [{ messageId: 'styleAttribute' }],
    },
    {
      code: `renderer.setAttributes(el, { style: css });`,
      errors: [{ messageId: 'styleAttribute' }],
    },
    {
      code: `const create = () => document.createElement('style');`,
      errors: [{ messageId: 'missingNonce', data: { tag: 'style' } }],
    },
    {
      code: `const load = () => { const s = document.createElement('script'); s.src = url; document.head.append(s); };`,
      errors: [{ messageId: 'missingNonce', data: { tag: 'script' } }],
    },
    {
      code: `const load = (other) => { const s = document.createElement('script'); other.nonce = nonce; };`,
      errors: [{ messageId: 'missingNonce' }],
    },
    {
      code: `const a = () => { const s = document.createElement('style'); }; const b = (s) => { s.nonce = n; };`,
      errors: [{ messageId: 'missingNonce' }],
    },
    {
      code: `eval(code);`,
      errors: [{ messageId: 'dynamicCode', data: { name: 'eval' } }],
    },
    {
      code: `const fn = new Function('a', 'return a');`,
      errors: [{ messageId: 'dynamicCode', data: { name: 'new Function' } }],
    },
    {
      code: `const fn = Function('return 1');`,
      errors: [{ messageId: 'dynamicCode', data: { name: 'Function' } }],
    },
    {
      code: `setTimeout('tick()', 10);`,
      errors: [{ messageId: 'dynamicCode', data: { name: 'setTimeout(string)' } }],
    },
    {
      code: 'window.setInterval(`tick(${n})`, 10);',
      errors: [{ messageId: 'dynamicCode', data: { name: 'setInterval(string)' } }],
    },
    {
      code: `const html = '<div style="color: red">x</div>';`,
      errors: [{ messageId: 'htmlStyleAttribute' }],
    },
    {
      code: 'const html = `<${name} style="text-align: ${align}">${inner}</${name}>`;',
      errors: [{ messageId: 'htmlStyleAttribute' }],
    },
    {
      code: `const story = { render: () => ({ template: '<span class="a" style="color: red"></span>' }) };`,
      errors: [{ messageId: 'htmlStyleAttribute' }],
    },
    {
      code: `@Component({ selector: 'x', host: { style: 'display: block' } }) class A {}`,
      errors: [{ messageId: 'styleAttribute' }],
    },
    {
      code: `@Directive({ selector: '[x]', host: { '[attr.style]': 'css()' } }) class A {}`,
      errors: [{ messageId: 'styleAttribute' }],
    },
  ],
});

templateTester.run('no-csp-unsafe', rule, {
  valid: [
    { code: `<div [style.color]="color()"></div>`, filename: 'test.html' },
    { code: `<div [style]="styles()"></div>`, filename: 'test.html' },
    { code: `<div [style.--et-size.px]="size()" class="a"></div>`, filename: 'test.html' },
    { code: `<svg><text font-style="italic">I</text></svg>`, filename: 'test.html' },
    { code: `<!-- <div style="color: red"></div> -->`, filename: 'test.html' },
  ],
  invalid: [
    {
      code: `<div style="color: red"></div>`,
      filename: 'test.html',
      errors: [{ messageId: 'templateStyleAttribute' }],
    },
    {
      code: `@if (a) { <et-skeleton-item style="block-size: 12px" /> }`,
      filename: 'test.html',
      errors: [{ messageId: 'templateStyleAttribute' }],
    },
    {
      code: `<div [attr.style]="css()"></div>`,
      filename: 'test.html',
      errors: [{ messageId: 'styleAttribute' }],
    },
  ],
});
