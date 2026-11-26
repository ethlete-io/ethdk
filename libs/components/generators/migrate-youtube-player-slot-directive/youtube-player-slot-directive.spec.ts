import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { migrateRemovedExportsInFile } from '../removed-exports/removed-exports';
import migrateYoutubePlayerSlotDirective, { YOUTUBE_PLAYER_SLOT_DIRECTIVE_REPORT_PATH } from './migration';
import { YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS } from './youtube-player-slot-directive';

const FILE = 'apps/shop/src/app/video.component.ts';

const migrate = (content: string) => migrateRemovedExportsInFile(FILE, content, YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS);

describe('migrate-youtube-player-slot-directive', () => {
  it('drops the directive from the import and the imports array', () => {
    const { next, tasks } = migrate(
      [
        "import { STREAM_IMPORTS, YoutubePlayerSlotDirective } from '@ethlete/components';",
        '',
        '@Component({ imports: [STREAM_IMPORTS, YoutubePlayerSlotDirective], template: `<et-youtube-player-slot />` })',
        'export class VideoComponent {}',
      ].join('\n'),
    );

    expect(next).toBe(
      [
        "import { STREAM_IMPORTS } from '@ethlete/components';",
        '',
        '@Component({ imports: [STREAM_IMPORTS], template: `<et-youtube-player-slot />` })',
        'export class VideoComponent {}',
      ].join('\n'),
    );
    expect(tasks).toEqual([]);
  });

  it('removes an import statement that only held the directive', () => {
    const { next } = migrate(
      [
        "import { Component } from '@angular/core';",
        "import { YoutubePlayerSlotDirective } from '@ethlete/components';",
        '',
        '@Component({',
        '  imports: [',
        '    YoutubePlayerSlotDirective,',
        '  ],',
        '})',
        'export class VideoComponent {}',
      ].join('\n'),
    );

    expect(next).toBe(
      [
        "import { Component } from '@angular/core';",
        '',
        '@Component({',
        '  imports: [],',
        '})',
        'export class VideoComponent {}',
      ].join('\n'),
    );
  });

  it('marks a host directive and an injected token, and keeps their imports', () => {
    const { next, tasks } = migrate(
      [
        "import { YOUTUBE_PLAYER_SLOT_TOKEN, YoutubePlayerSlotDirective } from '@ethlete/components';",
        '',
        '@Directive({ hostDirectives: [YoutubePlayerSlotDirective] })',
        'export class VideoDirective {',
        '  slot = inject(YOUTUBE_PLAYER_SLOT_TOKEN);',
        '}',
      ].join('\n'),
    );

    expect(next).toBe(
      [
        "import { YOUTUBE_PLAYER_SLOT_TOKEN, YoutubePlayerSlotDirective } from '@ethlete/components';",
        '',
        `// TODO(ethlete-migration): ${YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS[0]?.todo}`,
        '@Directive({ hostDirectives: [YoutubePlayerSlotDirective] })',
        'export class VideoDirective {',
        `  // TODO(ethlete-migration): ${YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS[1]?.todo}`,
        '  slot = inject(YOUTUBE_PLAYER_SLOT_TOKEN);',
        '}',
      ].join('\n'),
    );
    expect(tasks.map((task) => `${task.name}:${task.line}`)).toEqual([
      'YoutubePlayerSlotDirective:4',
      'YOUTUBE_PLAYER_SLOT_TOKEN:7',
    ]);
    expect(migrate(next ?? '').next).toBeNull();
  });

  it('leaves a directive of the same name from elsewhere alone', () => {
    expect(
      migrate(
        "import { YoutubePlayerSlotDirective } from './slot';\n@Component({ imports: [YoutubePlayerSlotDirective] })",
      ).next,
    ).toBeNull();
  });

  it('keeps an aliased import alive under its alias', () => {
    const { next } = migrate(
      "import { YoutubePlayerSlotDirective as Slot } from '@ethlete/components';\n@Component({ imports: [Slot] })",
    );

    expect(next).toBe('@Component({ imports: [] })');
  });

  it('writes the report only for the sites it could not fix', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      FILE,
      "import { YoutubePlayerSlotDirective } from '@ethlete/components';\n@Component({ imports: [YoutubePlayerSlotDirective] })\n",
    );
    tree.write(
      'apps/shop/src/app/host.directive.ts',
      "import { YoutubePlayerSlotDirective } from '@ethlete/components';\n@Directive({ hostDirectives: [YoutubePlayerSlotDirective] })\n",
    );

    await migrateYoutubePlayerSlotDirective(tree, { skipFormat: true });

    expect(tree.read(FILE, 'utf-8')).toBe('@Component({ imports: [] })\n');
    const report = tree.read(YOUTUBE_PLAYER_SLOT_DIRECTIVE_REPORT_PATH, 'utf-8');
    expect(report).toContain('apps/shop/src/app/host.directive.ts:3');
    expect(report).not.toContain(FILE);
  });
});
