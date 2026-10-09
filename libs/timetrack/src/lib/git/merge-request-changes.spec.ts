import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MergeRequestActivityEvent } from '../model/event';
import { ProcessSpec } from '../transport/ports';
import { checkoutsOfProject, collectMergeRequestChanges$, parseMergeRequestChanges } from './merge-request-changes';

const activity = (minute: number): MergeRequestActivityEvent => ({
  at: new Date(2026, 9, 9, 11, minute),
  source: 'gitlab',
  kind: 'merge-request-activity',
  eventId: `event-${minute}`,
  action: 'commented on',
  projectPath: 'group/app-a-frontend',
  mergeRequestIid: '1095',
  branch: 'feature/restore-orders',
});

describe('parseMergeRequestChanges', () => {
  it('reads the newest commit and the directories of the changed files', () => {
    expect(
      parseMergeRequestChanges(
        '\u0000abc\n\nlibs/hub/src/a.ts\nlibs/hub/src/b.ts\npackage.json\n\u0000def\n\nlibs/x/y.ts\n',
      ),
    ).toEqual({ head: 'abc', directories: ['libs/hub/src', 'libs/x'] });
  });

  it('answers nothing for a branch with no commits of its own', () => {
    expect(parseMergeRequestChanges('')).toBeNull();
  });
});

describe('checkoutsOfProject', () => {
  it('matches a checkout by its remote key before its directory name', () => {
    const repoKeys = { '/dev/app-a': 'gitlab.example.com/group/app-a-frontend', '/dev/app-a-frontend': 'other' };

    expect(checkoutsOfProject({ projectPath: 'group/app-a-frontend', repoKeys })).toEqual(['/dev/app-a']);
    expect(checkoutsOfProject({ projectPath: 'group/other', repoKeys: { '/dev/other': 'x' } })).toEqual(['/dev/other']);
  });
});

describe('collectMergeRequestChanges$', () => {
  it('reads each branch once and answers one event per activity', async () => {
    const runs: ProcessSpec[] = [];
    const events = await firstValueFrom(
      collectMergeRequestChanges$({
        processes: {
          run$: (spec) => {
            runs.push(spec);

            return of({ code: 0, stdout: '\u0000abc\n\nlibs/hub/src/a.ts\n', stderr: '' });
          },
        },
        events: [activity(21), activity(22)],
        repoKeys: { '/dev/app-a': 'gitlab.example.com/group/app-a-frontend' },
      }),
    );

    expect(runs).toHaveLength(1);
    expect(runs[0]?.cwd).toBe('/dev/app-a');
    expect(runs[0]?.args.some((arg) => arg.includes('\u0000'))).toBe(false);
    expect(events.map((event) => [event.eventId, event.repoPath, event.head, event.directories])).toEqual([
      ['event-21', '/dev/app-a', 'abc', ['libs/hub/src']],
      ['event-22', '/dev/app-a', 'abc', ['libs/hub/src']],
    ]);
  });
});
