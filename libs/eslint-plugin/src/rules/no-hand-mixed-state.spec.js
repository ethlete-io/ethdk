// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const plugin = require('../index');
const rule = require('./no-hand-mixed-state');

const tester = new RuleTester({
  plugins: { ethlete: plugin },
  language: 'ethlete/css',
});

tester.run('no-hand-mixed-state', rule, {
  valid: [
    {
      code: `.et-select-option {
  &:hover {
    background: color-mix(in srgb, var(--et-surface-tint, var(--et-surface-text, gray)) 10%, transparent);
  }
}`,
    },
    {
      code: `.et-menu-item:active {
  background: color-mix(
    in srgb,
    var(--et-surface-tint, var(--et-surface-text, rgb(255 255 255))) 20%,
    transparent
  );
}`,
    },
    {
      code: `.et-table {
  --_et-table-band: color-mix(
    in srgb,
    var(--et-surface-tint, var(--et-surface-text, gray)) 7%,
    var(--et-surface-background, Canvas)
  );
}`,
    },
    { code: `.et-chip:hover { background: var(--et-chip-hover-bg, rgb(0 0 0 / 0.1)); }` },
    { code: `.et-button:hover { background: var(--et-tone-fill-hover); }` },
    { code: `.et-tab { color: var(--et-tab-inactive-color, var(--et-surface-control-text, inherit)); }` },
    { code: `.et-rte-toolbar { border-block-end: 1px solid color-mix(in srgb, currentColor 12%, transparent); }` },
    { code: `.et-grid { background: color-mix(in srgb, var(--et-surface-text, rgb(23 23 23)) 8%, transparent); }` },
    { code: `.et-row:hover { color: color-mix(in srgb, currentColor 72%, transparent); }` },
    { code: `/* :hover { background: var(--et-surface-tint, gray); } */ .a { color: red; }` },
  ],
  invalid: [
    {
      code: `.et-select-extras:hover {
  background: color-mix(in srgb, var(--et-surface-tint, gray) 10%, transparent);
}`,
      errors: [{ messageId: 'tintWithoutText', data: { text: 'var(--et-surface-tint, gray)' }, line: 2, column: 34 }],
    },
    {
      code: `.et-breadcrumb-item:hover { background: color-mix(in srgb, var(--et-surface-tint) 12%, transparent); }`,
      errors: [{ messageId: 'tintWithoutText', data: { text: 'var(--et-surface-tint)' } }],
    },
    {
      code: `.et-menu-item {
  &:active {
    background: color-mix(
      in srgb,
      var(--et-surface-control-text, rgb(255 255 255)) 20%,
      transparent
    );
  }
}`,
      errors: [
        {
          messageId: 'controlTextMix',
          data: { text: 'var(--et-surface-control-text, rgb(255 255 255))' },
          line: 5,
          column: 7,
        },
      ],
    },
    {
      code: `.et-table {
  --_et-table-hover-solid: color-mix(
      in srgb,
      var(--et-surface-control-text, gray) 8%,
      var(--_et-table-row-surface)
  );
}`,
      errors: [{ messageId: 'controlTextMix' }],
    },
    {
      code: `.et-chip:where([aria-pressed='true']) { background: color-mix(in srgb, currentColor 16%, transparent); }`,
      errors: [{ messageId: 'staticState', data: { text: 'currentColor' } }],
    },
    {
      code: `.et-row:hover { background: color-mix(in srgb, var(--et-surface-text, gray) 8%, transparent); }`,
      errors: [{ messageId: 'staticState' }],
    },
    {
      code: `.et-row { --_et-row-hover-bg: rgb(0 0 0 / 0.06); }`,
      errors: [{ messageId: 'staticState', data: { text: 'rgb(0 0 0 / 0.06)' } }],
    },
    {
      code: `.et-option[aria-selected='true'] { background-color: #eee; }`,
      errors: [{ messageId: 'staticState', data: { text: '#eee' } }],
    },
  ],
});
