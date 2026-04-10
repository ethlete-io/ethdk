// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-direct-dom-manipulation');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-direct-dom-manipulation', rule, {
  valid: [
    // renderer calls — correct pattern, exempt
    { code: `this.renderer.createElement('div');` },
    { code: `this.renderer.appendChild(parent, child);` },
    { code: `this.renderer.setAttribute(el, 'disabled', '');` },
    { code: `const r = injectRenderer(); r.addClass(el, 'active');` },
    // Unrelated member calls
    { code: `arr.push(item);` },
    { code: `map.set(key, value);` },
  ],
  invalid: [
    {
      code: `document.createElement('div');`,
      errors: [{ messageId: 'domCreate' }],
    },
    {
      code: `parent.appendChild(child);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.setAttribute('disabled', '');`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.classList.add('active');`,
      errors: [{ messageId: 'domClassList' }],
    },
    {
      code: `el.classList.remove('active');`,
      errors: [{ messageId: 'domClassList' }],
    },
    {
      code: `el.style.color = 'red';`,
      errors: [{ messageId: 'domStyle' }],
    },
  ],
});
