import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { MIGRATION_TODO, migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import { DURATION_FORMAT_INTERNALS_REMOVALS } from './duration-format-internals';
import migrateDurationFormatInternals, { DURATION_FORMAT_INTERNALS_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/lap.ts';

const migrate = (content: string) => migrateRemovedExportsInFile(FILE, content, DURATION_FORMAT_INTERNALS_REMOVALS);

describe('migrate-duration-format-internals', () => {
  it('keeps the exports that stay public', () => {
    const source = "import { DurationInputDirective, type DurationFormatSpec } from '@ethlete/components';";

    expect(migrate(source).next).toBeNull();
  });

  it('marks the use of a helper it cannot rewrite', () => {
    const { next, tasks } = migrate(
      [
        "import { DurationInputComponent, UNIT_MS } from '@ethlete/components';",
        '',
        'export const lap = 2 * UNIT_MS.m;',
      ].join('\n'),
    );

    expect(next).toContain("import { DurationInputComponent, UNIT_MS } from '@ethlete/components';");
    expect(next).toContain(`// ${MIGRATION_TODO}: UNIT_MS is no longer exported`);
    expect(tasks.map((task) => task.name)).toEqual(['UNIT_MS']);
  });

  it('leaves the same names imported from elsewhere alone', () => {
    expect(migrate("import { formatDuration } from './format';").next).toBeNull();
  });

  it('writes a report for the uses it marked', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      [
        "import { deriveDurationFormatSpec, formatDuration } from '@ethlete/components';",
        "export const label = formatDuration(90_000, deriveDurationFormatSpec('mm:ss'));",
        '',
      ].join('\n'),
    );

    await migrateDurationFormatInternals(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toContain(MIGRATION_TODO);
    expect(tree.read(DURATION_FORMAT_INTERNALS_REPORT_PATH, 'utf-8')).toContain('formatDuration');
  });
});
