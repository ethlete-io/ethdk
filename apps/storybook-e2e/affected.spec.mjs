import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL, buildIndex, selectE2eFolders, titleToId } from './affected.mjs';

const lib = (path) => `libs/components/src/lib/${path}`;

const index = buildIndex({
  componentFiles: new Map([
    [lib('icon/icon.component.ts'), `@Component({ styleUrl: './icon.component.css' }) export class IconComponent {}`],
    [lib('icon/icon.component.css'), '.et-icon {}'],
    [lib('button/button.component.ts'), `import { IconComponent } from '../icon/icon.component';`],
    [
      lib('button/stories/button.stories.ts'),
      `import '../button.component'; export default { title: 'Components/Actions/Button' };`,
    ],
    [lib('forms/select/select.component.ts'), `import { Overlay } from '../../overlay/overlay';`],
    [lib('forms/select/stories/select-demo.component.ts'), `import { Select } from '../select.component';`],
    [
      lib('forms/select/stories/select.stories.ts'),
      `import './select-demo.component'; export default { title: 'Components/Forms/Select' };`,
    ],
    [lib('forms/slider/slider.component.ts'), `export class Slider {}`],
    [
      lib('forms/slider/stories/slider.stories.ts'),
      `import '../slider.component'; export default { title: 'Components/Forms/Slider' };`,
    ],
    [lib('overlay/overlay.ts'), `export const provideOverlay = () => [];`],
    [lib('table/table.component.ts'), `export class Table {}`],
    [
      lib('table/stories/table.stories.ts'),
      `import '../table.component'; export default { title: 'Components/Data Display/Table' };`,
    ],
  ]),
  e2eFolders: new Map([
    ['button', `openStory(page, 'components-actions-button--default');`],
    ['select', `openStory(page, 'components-forms-select--default');`],
    ['slider', `openStory(page, 'components-forms-slider--default');`],
    ['table', `openStory(page, 'components-data-display-table--default');`],
    ['core-overlay', `openStory(page, 'core-overlay-runtime--default');`],
    ['renamed', `openStory(page, 'components-gone--default');`],
  ]),
  previewSource: `import { provideOverlay } from '@ethlete/components';`,
});

test('titleToId matches Storybook ids', () => {
  assert.equal(titleToId('Components/Forms/Select/Option group'), 'components-forms-select-option-group');
});

test('a component change selects every suite whose stories import it, transitively', () => {
  assert.deepEqual(selectE2eFolders([lib('icon/icon.component.css')], index), ['button', 'renamed']);
});

test('nested forms domains stay separate', () => {
  assert.deepEqual(selectE2eFolders([lib('forms/slider/slider.component.ts')], index), ['renamed', 'slider']);
});

test('a story helper change selects the suite of the story that imports it', () => {
  assert.deepEqual(selectE2eFolders([lib('forms/select/stories/select-demo.component.ts')], index), [
    'renamed',
    'select',
  ]);
});

test('an e2e folder change selects that folder', () => {
  assert.deepEqual(selectE2eFolders(['apps/storybook-e2e/src/table/table.e2e.ts'], index), ['renamed', 'table']);
});

test('non-behavioral files select nothing', () => {
  assert.deepEqual(
    selectE2eFolders(
      [
        'libs/eslint-plugin/src/rules/x.js',
        '.changeset/x.md',
        'apps/docs/components/table.md',
        lib('table/table.component.spec.ts'),
      ],
      index,
    ),
    [],
  );
});

test('shared code, other libs and components the preview loads select everything', () => {
  for (const file of [
    'libs/core/src/lib/x.ts',
    'apps/storybook-e2e/src/support/focus.ts',
    'apps/storybook-e2e/playwright.config.ts',
    'apps/storybook/src/styles/themes.css',
    'yarn.lock',
    lib('overlay/overlay.ts'),
  ]) {
    assert.equal(selectE2eFolders([lib('table/table.component.ts'), file], index), ALL, file);
  }
});
