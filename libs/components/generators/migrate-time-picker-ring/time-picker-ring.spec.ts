import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIGRATION_TODO, migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import migrateTimePickerRing, { TIME_PICKER_RING_REPORT_PATH } from './migration';
import { replaceSetActiveSide, TIME_PICKER_RING_REMOVALS } from './time-picker-ring';

const FILE = 'apps/shop/src/app/slot.ts';

describe('migrate-time-picker-ring', () => {
  afterEach(() => vi.restoreAllMocks());

  it('turns setActiveSide into activeSide.set', () => {
    expect(
      replaceSetActiveSide(
        [
          "import { TimePickerDirective } from '@ethlete/components';",
          'export class C { pick = viewChild.required(TimePickerDirective); go() { this.pick().setActiveSide(side); } }',
        ].join('\n'),
      ),
    ).toContain('this.pick().activeSide.set(side)');
  });

  it('leaves setActiveSide alone in a file that has no time picker', () => {
    expect(replaceSetActiveSide('carousel.setActiveSide(1);')).toBeNull();
  });

  it('marks the removed column and option directives', () => {
    const { next, tasks } = migrateRemovedExportsInFile(
      FILE,
      [
        "import { TimePickerColumnDirective, TimePickerOptionDirective } from '@ethlete/components';",
        'export const columns = viewChildren(TimePickerColumnDirective);',
        'export const options = viewChildren(TimePickerOptionDirective);',
      ].join('\n'),
      TIME_PICKER_RING_REMOVALS,
    );

    expect(next).toContain(`// ${MIGRATION_TODO}: TimePickerColumnDirective is removed`);
    expect(tasks.map((task) => task.name)).toEqual(['TimePickerColumnDirective', 'TimePickerOptionDirective']);
  });

  it('rewrites a workspace, reports the removed directives and warns about their template selectors', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      [
        "import { TimePickerDirective, TimePickerColumnDirective } from '@ethlete/components';",
        'export const columns = viewChildren(TimePickerColumnDirective);',
        'export const go = (picker: TimePickerDirective) => picker.setActiveSide(side);',
        '',
      ].join('\n'),
    );
    tree.write(
      'apps/shop/src/app/slot.html',
      '<div etTimePicker #p="etTimePicker"><div etTimePickerColumn></div></div>\n',
    );

    await migrateTimePickerRing(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toContain('picker.activeSide.set(side)');
    expect(tree.read(FILE, 'utf-8')).toContain(MIGRATION_TODO);
    expect(tree.read(TIME_PICKER_RING_REPORT_PATH, 'utf-8')).toContain('TimePickerColumnDirective');
    expect(tree.read('apps/shop/src/app/slot.html', 'utf-8')).toContain('etTimePickerColumn');
    expect(warn.mock.calls.flat().join('\n')).toContain('apps/shop/src/app/slot.html');
  });
});
