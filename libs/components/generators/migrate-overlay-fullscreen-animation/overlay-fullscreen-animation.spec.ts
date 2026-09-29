import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { MIGRATION_TODO, migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import { OVERLAY_FULLSCREEN_ANIMATION_REMOVALS } from './overlay-fullscreen-animation';
import migrateOverlayFullscreenAnimation, { OVERLAY_FULLSCREEN_ANIMATION_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/overlay.ts';

const migrate = (content: string) => migrateRemovedExportsInFile(FILE, content, OVERLAY_FULLSCREEN_ANIMATION_REMOVALS);

describe('migrate-overlay-fullscreen-animation', () => {
  it('leaves the public strategy factory alone', () => {
    expect(migrate("import { fullScreenDialogOverlayStrategy } from '@ethlete/components';").next).toBeNull();
  });

  it('marks the use of an animation helper it cannot rewrite', () => {
    const { next, tasks } = migrate(
      [
        "import { OverlayRef, abortFullscreenAnimation } from '@ethlete/components';",
        '',
        'export const stop = () => abortFullscreenAnimation({} as never);',
      ].join('\n'),
    );

    expect(next).toContain(`// ${MIGRATION_TODO}: abortFullscreenAnimation is no longer exported`);
    expect(tasks.map((task) => task.name)).toEqual(['abortFullscreenAnimation']);
  });

  it('leaves the same names imported from elsewhere alone', () => {
    expect(migrate("import { abortFullscreenAnimation } from './animation';").next).toBeNull();
  });

  it('writes a report for the uses it marked', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      [
        "import { cleanupFullscreenAnimationStyles } from '@ethlete/components';",
        'export const clean = () => cleanupFullscreenAnimationStyles({} as never);',
        '',
      ].join('\n'),
    );

    await migrateOverlayFullscreenAnimation(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toContain(MIGRATION_TODO);
    expect(tree.read(OVERLAY_FULLSCREEN_ANIMATION_REPORT_PATH, 'utf-8')).toContain('cleanupFullscreenAnimationStyles');
  });
});
