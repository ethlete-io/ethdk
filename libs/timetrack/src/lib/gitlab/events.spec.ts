import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ProcessSpec, TimetrackProcessRunner } from '../transport/ports';
import { fetchGitLabEvents$ } from './events';

const eventRunner = (pages: unknown[][]) => {
  const specs: ProcessSpec[] = [];
  let page = 0;
  const runner: TimetrackProcessRunner = {
    run$: vi.fn((spec: ProcessSpec) => {
      specs.push(spec);
      const current = pages[page] ?? [];
      page += 1;

      return of({ code: 0, stdout: JSON.stringify(current), stderr: '' });
    }),
  };

  return { runner, specs };
};

const endpointOf = (spec: ProcessSpec | undefined) => spec?.args.at(-1) ?? '';

const events = (runner: TimetrackProcessRunner) => {
  const seen = vi.fn();

  fetchGitLabEvents$({
    runner,
    hostname: 'git.example.com',
    from: new Date(2026, 7, 11, 0, 0),
    to: new Date(2026, 7, 11, 23, 59, 59),
    paging: { pageSize: 1 },
  }).subscribe(seen);

  return seen.mock.calls[0]?.[0] ?? [];
};

const APPROVAL = {
  id: 9001,
  created_at: '2026-08-11T09:15:00.000+02:00',
  action_name: 'approved',
  project_id: 42,
  target_type: 'MergeRequest',
  target_iid: 412,
  target_title: 'Club pack',
};

const NOTE = {
  id: 9002,
  created_at: '2026-08-11T09:20:00.000+02:00',
  action_name: 'commented on',
  project_id: 42,
  target_type: 'Note',
  note: { noteable_type: 'MergeRequest', noteable_iid: 412, body: 'looks good' },
};

describe('fetchGitLabEvents$', () => {
  it('asks the instance for the window with a day of slack at each end', () => {
    const { runner, specs } = eventRunner([[]]);

    events(runner);

    expect(specs[0]?.command).toBe('glab');
    expect(endpointOf(specs[0])).toContain('events?');
    expect(endpointOf(specs[0])).toContain('after=2026-08-10');
    expect(endpointOf(specs[0])).toContain('before=2026-08-12');
  });

  it('names the host on every call, because `glab` otherwise picks one from the working directory', () => {
    const { runner, specs } = eventRunner([[]]);

    events(runner);

    expect(specs[0]?.args.slice(0, 3)).toEqual(['api', '--hostname', 'git.example.com']);
  });

  it('reads the merge request a note was left on, which the event names only through the note', () => {
    const read = events(eventRunner([[APPROVAL], [NOTE], []]).runner);

    expect(read.map((event: { mergeRequestIid?: string }) => event.mergeRequestIid)).toEqual(['412', '412']);
    expect(read[0]).toMatchObject({ id: '9001', action: 'approved', projectId: '42', title: 'Club pack' });
  });

  it('takes the branch straight off a push, which is the one event that carries it', () => {
    const { runner } = eventRunner([
      [
        {
          id: 9003,
          created_at: '2026-08-11T10:00:00.000+02:00',
          action_name: 'pushed to',
          project_id: 42,
          push_data: { ref: 'sub/feat/FIP-2177-x/FIP-2178-y', ref_type: 'branch', commit_title: 'Add the thing' },
        },
      ],
      [],
    ]);

    expect(events(runner)[0]).toMatchObject({
      branch: 'sub/feat/FIP-2177-x/FIP-2178-y',
      title: 'Add the thing',
    });
  });

  it('drops what fell outside the window the wider query brought back', () => {
    const { runner } = eventRunner([
      [{ ...APPROVAL, id: 1, created_at: '2026-08-10T22:00:00.000+02:00' }],
      [APPROVAL],
      [],
    ]);

    expect(events(runner).map((event: { id: string }) => event.id)).toEqual(['9001']);
  });

  it('reads the next page while one comes back full, and stops on the first short one', () => {
    const { runner, specs } = eventRunner([[APPROVAL], [NOTE], []]);

    expect(events(runner)).toHaveLength(2);
    expect(specs).toHaveLength(3);
    expect(endpointOf(specs[1])).toContain('page=2');
  });

  it('ignores an event with no id, no project or no readable instant', () => {
    const { runner } = eventRunner([[{ ...APPROVAL, id: undefined }], [{ ...APPROVAL, created_at: 'not a date' }], []]);

    expect(events(runner)).toEqual([]);
  });
});
