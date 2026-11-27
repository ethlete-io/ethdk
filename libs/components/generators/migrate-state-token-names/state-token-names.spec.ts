import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import migrateStateTokenNames from './migration';
import { renameStateTokens, STATE_TOKEN_RENAMES } from './state-token-names';

const APP_A_STYLES = 'apps/app-a/src/styles/buttons.scss';
const APP_A_TEMPLATE = 'apps/app-a/src/app/shell.component.html';
const APP_B_COMPONENT = 'apps/app-b/src/app/title-bar.component.ts';
const APP_B_README = 'apps/app-b/README.md';

const createTree = (files: Record<string, string>) => {
  const tree = createTreeWithEmptyWorkspace();

  for (const [path, content] of Object.entries(files)) tree.write(path, content);

  return tree;
};

describe('migrate-state-token-names', () => {
  it('renames declarations and reads in a stylesheet', async () => {
    const tree = createTree({
      [APP_A_STYLES]: [
        '.app-button {',
        '  --et-button-outline-hover-background: var(--et-tone-fill);',
        '  --et-button-outline-hover-border-color: var(--et-tone-fill);',
        '  --et-button-opacity-disabled: 1;',
        '  --et-select-option-background-hover: var(--et-surface-next-background);',
        '  --et-form-field-control-border-color-focus: red;',
        '  color: var(--et-select-option-color-selected, currentColor);',
        '}',
        '',
      ].join('\n'),
    });

    await migrateStateTokenNames(tree, { skipFormat: true });

    expect(tree.read(APP_A_STYLES, 'utf-8')).toBe(
      [
        '.app-button {',
        '  --et-button-outline-hover: var(--et-tone-fill);',
        '  --et-button-outline-hover-border-color: var(--et-tone-fill);',
        '  --et-button-disabled-opacity: 1;',
        '  --et-select-option-hover: var(--et-surface-next-background);',
        '  --et-form-field-control-focus-border-color: red;',
        '  color: var(--et-select-option-selected-color, currentColor);',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('renames Tailwind arbitrary properties in templates and inline templates', async () => {
    const tree = createTree({
      [APP_A_TEMPLATE]:
        '<et-accordion class="[--et-accordion-header-hover-background:var(--et-surface-next-background)]" />\n',
      [APP_B_COMPONENT]:
        'template: `<span class="[--et-window-control-button-close-background-active:var(--et-tone-fill-active)]"></span>`,\n',
    });

    await migrateStateTokenNames(tree, { skipFormat: true });

    expect(tree.read(APP_A_TEMPLATE, 'utf-8')).toBe(
      '<et-accordion class="[--et-accordion-header-hover:var(--et-surface-next-background)]" />\n',
    );
    expect(tree.read(APP_B_COMPONENT, 'utf-8')).toBe(
      'template: `<span class="[--et-window-control-button-close-active:var(--et-tone-fill-active)]"></span>`,\n',
    );
  });

  it('leaves names that only share a prefix, private names and unscanned files alone', async () => {
    const untouched = [
      '.a { --et-button-outline-hover-background-extra: 1; }',
      '.b { --_et-select-option-background-hover: red; }',
      '.c { --my-et-tab-hover-underline-opacity: 1; }',
      '',
    ].join('\n');
    const tree = createTree({
      'apps/app-b/src/untouched.css': untouched,
      [APP_B_README]: '--et-chip-opacity-disabled\n',
    });

    await migrateStateTokenNames(tree, { skipFormat: true });

    expect(tree.read('apps/app-b/src/untouched.css', 'utf-8')).toBe(untouched);
    expect(tree.read(APP_B_README, 'utf-8')).toBe('--et-chip-opacity-disabled\n');
  });

  it('is idempotent and maps every old name to a name outside the old set', () => {
    const once = renameStateTokens(Object.keys(STATE_TOKEN_RENAMES).join('\n')) ?? '';

    expect(renameStateTokens(once)).toBeNull();
    expect(once.split('\n')).toEqual(Object.values(STATE_TOKEN_RENAMES));
  });
});
