import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { MIGRATION_TODO, migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import { GRID_ENGINE_INTERNALS_REMOVALS } from './grid-engine-internals';
import migrateGridEngineInternals, { GRID_ENGINE_INTERNALS_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/board.ts';

const migrate = (content: string) => migrateRemovedExportsInFile(FILE, content, GRID_ENGINE_INTERNALS_REMOVALS);

describe('migrate-grid-engine-internals', () => {
  it('keeps the exports that stay public', () => {
    const source =
      "import { serializeGridLayout, deserializeGridLayout, DEFAULT_BREAKPOINTS } from '@ethlete/components';";

    expect(migrate(source).next).toBeNull();
  });

  it('marks the use of an internal it cannot rewrite', () => {
    const { next, tasks } = migrate(
      [
        "import { GridComponent, autoPlace } from '@ethlete/components';",
        '',
        'export const place = () => autoPlace({ entries: [], colSpan: 1, rowSpan: 1, columns: 6 });',
      ].join('\n'),
    );

    expect(next).toContain("import { GridComponent, autoPlace } from '@ethlete/components';");
    expect(next).toContain(`// ${MIGRATION_TODO}: autoPlace is no longer exported`);
    expect(tasks.map((task) => task.name)).toEqual(['autoPlace']);
  });

  it('leaves the same names imported from elsewhere alone', () => {
    expect(migrate("import { autoPlace } from './engine';").next).toBeNull();
  });

  it('writes a report for the uses it marked', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      [
        "import { computeGeometry } from '@ethlete/components';",
        'export const geometry = computeGeometry({ contentWidth: 800, columns: 6, gap: 16, rowHeight: 90 });',
        '',
      ].join('\n'),
    );

    await migrateGridEngineInternals(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toContain(MIGRATION_TODO);
    expect(tree.read(GRID_ENGINE_INTERNALS_REPORT_PATH, 'utf-8')).toContain('computeGeometry');
  });
});
