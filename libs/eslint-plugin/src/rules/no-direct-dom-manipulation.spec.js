// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-direct-dom-manipulation');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-direct-dom-manipulation', rule, {
  valid: [
    { code: `this.mockRenderer.appendChild(a);` },
    { code: `Object.assign(this.renderer2.style, { color: "red" });` },
    { code: `Object.assign(state, { a: 1 });` },
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
      code: `el["appendChild"](child);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `this.renderer.host.appendChild(child);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `rendererCache.appendChild(child);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `Object.assign(el.style, { color: "red" });`,
      errors: [{ messageId: 'domStyle' }],
    },
    {
      code: `el["classList"]["add"]("a");`,
      errors: [{ messageId: 'domClassList' }],
    },
    {
      code: `el.removeChild(child);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.insertBefore(a, b);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.replaceChild(a, b);`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.toggleAttribute("x");`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `el.removeAttribute("x");`,
      errors: [{ messageId: 'domMutation' }],
    },
    {
      code: `document.createTextNode("x");`,
      errors: [{ messageId: 'domCreate' }],
    },
    {
      code: `document.createComment("x");`,
      errors: [{ messageId: 'domCreate' }],
    },
    {
      code: `document.createDocumentFragment();`,
      errors: [{ messageId: 'domCreate' }],
    },
    {
      code: `el.classList.toggle("a");`,
      errors: [{ messageId: 'domClassList' }],
    },
    {
      code: `el.classList.replace("a", "b");`,
      errors: [{ messageId: 'domClassList' }],
    },
    {
      code: `el.style.setProperty("--a", "1");`,
      errors: [{ messageId: 'domMutation' }],
    },
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
    {
      code: `el.style.setProperty('--et-size', '1px');`,
      errors: [
        {
          messageId: 'domMutation',
          data: {
            method: 'setProperty',
            alternative: 'renderer.setStyle(el, prop, value, RendererStyleFlags2.DashCase)',
          },
        },
      ],
    },
  ],
});
