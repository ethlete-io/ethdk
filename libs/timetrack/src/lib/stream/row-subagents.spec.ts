import { describe, expect, it } from 'vitest';
import { AgentSessionEvent, CollectedEvent } from '../model/event';
import { agentSamplesOf, isSubagentStripe, subagentsWithin } from './row-subagents';

const API = '/home/human/dev/billing-api';
const SITE = '/home/human/dev/marketing-site';
const ROOTS = [API, SITE];

const AT = (minutes: number) => new Date(new Date(2026, 2, 3, 13, 0, 0).getTime() + minutes * 60_000);

const sample = (
  minutes: number,
  options: { session?: string; cwd?: string; agentId?: string; agentTask?: string } = {},
): AgentSessionEvent => ({
  at: AT(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: options.session ?? 'parent',
  cwd: options.cwd ?? API,
  ...(options.agentId ? { agentId: options.agentId } : {}),
  ...(options.agentTask ? { agentTask: options.agentTask } : {}),
});

const within = (samples: AgentSessionEvent[], options: { from?: number; to?: number; sessions?: string[] } = {}) =>
  subagentsWithin({
    samples,
    roots: ROOTS,
    laneKey: `repo:${API}`,
    from: AT(options.from ?? 0),
    to: AT(options.to ?? 120),
    sessions: options.sessions,
  });

const migration = (minutes: number) =>
  sample(minutes, { agentId: 'mig', agentTask: 'Port the invoice table to the new schema' });

describe('subagentsWithin', () => {
  it('spans each subagent from its first to its last sample, with its task', () => {
    const found = within([sample(0), migration(10), migration(31), migration(52), sample(90)]);

    expect(found).toEqual([
      { agentId: 'mig', task: 'Port the invoice table to the new schema', from: AT(10), to: AT(52) },
    ]);
  });

  it('splits stripes from short runs at 15 minutes', () => {
    const found = within([
      sample(0),
      migration(5),
      migration(20),
      sample(40, { agentId: 'lint', agentTask: 'Run lint' }),
      sample(54, { agentId: 'lint' }),
    ]);

    expect(found.map((subagent) => [subagent.agentId, isSubagentStripe(subagent)])).toEqual([
      ['mig', true],
      ['lint', false],
    ]);
  });

  it('takes the task from a later sample when the first carries none', () => {
    const found = within([
      sample(0),
      sample(3, { agentId: 'doc' }),
      sample(9, { agentId: 'doc', agentTask: 'Read the ADR' }),
    ]);

    expect(found[0]?.task).toBe('Read the ADR');
  });

  it('hangs a subagent only on a row its own session ran in', () => {
    const found = within([
      sample(0, { session: 'other', cwd: SITE }),
      sample(10, { session: 'other', agentId: 'stray', agentTask: 'Unrelated' }),
    ]);

    expect(found).toEqual([]);
  });

  it('hangs the subagents of every session of the row piece, though its first session has no sample there', () => {
    const samples = [
      sample(0, { session: 'first' }),
      sample(60, { session: 'second' }),
      sample(61, { session: 'third' }),
      sample(62, { session: 'second', agentId: 's1', agentTask: 'Quieter frame' }),
      sample(63, { session: 'third', agentId: 't1' }),
      sample(64, { session: 'other', agentId: 'o1' }),
    ];
    const found = within(samples, { from: 60, to: 90, sessions: ['first', 'second', 'third'] });

    expect(found.map((subagent) => subagent.agentId)).toEqual(['s1', 't1']);
  });

  it('narrows to the sessions for a row of parallel siblings', () => {
    const samples = [
      sample(0, { session: 'a' }),
      sample(1, { session: 'b' }),
      sample(5, { session: 'a', agentId: 'a1' }),
      sample(6, { session: 'b', agentId: 'b1' }),
    ];

    expect(within(samples, { sessions: ['b'] }).map((subagent) => subagent.agentId)).toEqual(['b1']);
    expect(within(samples).map((subagent) => subagent.agentId)).toEqual(['a1', 'b1']);
  });

  it('clips a run to the row window, the end being exclusive', () => {
    const found = within([sample(0), migration(10), migration(30), migration(60)], { to: 60 });

    expect(found[0]).toMatchObject({ from: AT(10), to: AT(30) });
  });

  it('answers nothing for a lane that names no checkout', () => {
    expect(
      subagentsWithin({
        samples: [sample(0), migration(1)],
        roots: ROOTS,
        laneKey: 'app:code',
        from: AT(0),
        to: AT(9),
      }),
    ).toEqual([]);
  });
});

describe('agentSamplesOf', () => {
  it('keeps only agent session samples', () => {
    const events: CollectedEvent[] = [
      sample(0),
      migration(10),
      { at: AT(3), source: 'window', kind: 'window-focus', appId: 'code', title: 'x' },
    ];

    expect(agentSamplesOf({ events, roots: ROOTS })).toHaveLength(2);
  });
});
