import { describe, expect, it } from 'vitest';
import { AgentUsageEvent, CollectedEvent, TIMETRACK_PROVIDER } from '../model/event';
import { totalTokens } from '../model/tokens';
import { agentTurnsOf, agentUsageWithin } from './row-agent-usage';

const SDK = '/home/tom/dev/ethlete-sdk';
const FUT = '/home/tom/dev/fut-frontend';
const ROOTS = [SDK, FUT];

const AT = (minutes: number) => new Date(new Date(2026, 7, 12, 9, 0, 0).getTime() + minutes * 60_000);

const turn = (minutes: number, options: { cwd?: string; input?: number; provider?: string } = {}): AgentUsageEvent => ({
  at: AT(minutes),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: options.provider ?? 'claude-code',
  sessionId: 's1',
  turnId: `t${minutes}-${options.cwd ?? SDK}`,
  cwd: options.cwd ?? SDK,
  model: 'm',
  usage: { input: options.input ?? 10, output: 5, cacheWrite: 2, cacheRead: 100, thinking: 1 },
});

const within = (turns: AgentUsageEvent[], laneKey = `repo:${SDK}`, from = 0, to = 60) =>
  agentUsageWithin({ turns, roots: ROOTS, laneKey, from: AT(from), to: AT(to) });

describe('agentUsageWithin', () => {
  it('sums every token class of the turns in the lane and range', () => {
    const usage = within([turn(5), turn(20, { cwd: `${SDK}/libs/core` })]);

    expect(usage).toEqual({ input: 20, output: 10, cacheWrite: 4, cacheRead: 200, thinking: 2, turns: 2 });
    expect(usage && totalTokens(usage)).toBe(234);
  });

  it('leaves out a turn outside the range, the end being exclusive', () => {
    expect(within([turn(-1), turn(10), turn(30)], `repo:${SDK}`, 0, 30)?.turns).toBe(1);
  });

  it('leaves out a turn in another lane', () => {
    expect(within([turn(10, { cwd: FUT })])).toBeUndefined();
    expect(within([turn(10), turn(11, { cwd: FUT })])?.turns).toBe(1);
  });

  it('answers nothing for a lane that names no checkout', () => {
    expect(within([turn(10)], 'app:code')).toBeUndefined();
    expect(
      agentUsageWithin({ turns: [turn(10)], roots: ROOTS, laneKey: undefined, from: AT(0), to: AT(60) }),
    ).toBeUndefined();
  });
});

describe('agentTurnsOf', () => {
  it('drops the app own model calls and other events', () => {
    const events: CollectedEvent[] = [
      turn(1),
      turn(2, { provider: TIMETRACK_PROVIDER }),
      { at: AT(3), source: 'window', kind: 'window-focus', appId: 'code', title: 'x' },
    ];

    expect(agentTurnsOf({ events, roots: ROOTS })).toHaveLength(1);
  });
});
