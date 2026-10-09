import { describe, expect, it } from 'vitest';
import { AttributionRule, matchAttributionRule, standInIdOf } from '../model/attribution';
import { StandIn, findStandIn } from '../model/stand-in';
import { DEFAULT_TIMETRACK_SETTINGS } from './model';
import { parseTimetrackSettings } from './parse';
import {
  mergeStandIn,
  reopenStandIn,
  splitStandIn,
  resolveStandIn,
  settingsOnDay,
  withNamedStandIn,
  withRenamedStandIn,
  withStandIn,
  withStandInDay,
  withStandInIssue,
  withStandInCheckoutAllowed,
  withStandInParent,
  withStandInResolutionReset,
  withStandInsHidden,
  withStandInsKeyedByHand,
  withoutOrphanedStandIns,
  withoutStandIn,
} from './stand-in';

const standIn = (overrides: Partial<StandIn> = {}): StandIn => ({
  id: 'stand-in-1',
  name: 'Competition Journey',
  state: 'open',
  days: [],
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/home/tom/dev/ea-frontend',
  target: { kind: 'stand-in', standInId: 'stand-in-1' },
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

const settingsWith = (options: { standIns?: StandIn[]; rules?: AttributionRule[] } = {}) => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  standIns: options.standIns ?? [standIn()],
  attributionRules: options.rules ?? [rule()],
});

describe('withStandIn', () => {
  it('replaces the record with the same id', () => {
    const settings = withStandIn({ settings: settingsWith(), standIn: standIn({ name: 'Journey' }) });

    expect(settings.standIns).toHaveLength(1);
    expect(settings.standIns[0]?.name).toBe('Journey');
  });
});

describe('mergeStandIn', () => {
  const into = standIn({
    id: 'stand-in-2',
    name: 'Competition journey overlay',
    days: ['2026-09-21'],
    heldOn: ['feature/overlay'],
    createdAt: new Date('2026-09-18T00:00:00.000Z'),
  });
  const from = standIn({ days: ['2026-09-14', '2026-09-21'], heldOn: ['main-spec'], mergedIds: ['stand-in-0'] });
  const merged = () =>
    mergeStandIn({
      settings: settingsWith({
        standIns: [from, into, standIn({ id: 'stand-in-3' })],
        rules: [rule(), rule({ id: 'rule-2', target: { kind: 'stand-in', standInId: 'stand-in-3' } })],
      }),
      fromId: 'stand-in-1',
      intoId: 'stand-in-2',
    });

  it('keeps one record with the days, branches and age of both, and the name of the kept one', () => {
    const { settings, problem } = merged();

    expect(problem).toBeUndefined();
    expect(settings.standIns.map((entry) => entry.id)).toEqual(['stand-in-2', 'stand-in-3']);
    expect(settings.standIns[0]).toMatchObject({
      name: 'Competition journey overlay',
      days: ['2026-09-14', '2026-09-21'],
      heldOn: ['feature/overlay', 'main-spec'],
      mergedIds: ['stand-in-1', 'stand-in-0'],
      createdAt: new Date('2026-09-14T00:00:00.000Z'),
    });
  });

  it('points the rules of the merged one at the kept one and leaves other rules alone', () => {
    expect(merged().settings.attributionRules.map(standInIdOf)).toEqual(['stand-in-2', 'stand-in-3']);
  });

  it('finds the kept record under every merged id', () => {
    const { standIns } = merged().settings;

    expect(findStandIn({ id: 'stand-in-1', standIns })?.id).toBe('stand-in-2');
    expect(findStandIn({ id: 'stand-in-0', standIns })?.id).toBe('stand-in-2');
  });

  it('refuses a resolved one, an unknown id, and a merge into itself', () => {
    const settings = settingsWith({ standIns: [from, { ...into, state: 'resolved', issueKey: 'ET-1' }] });

    expect(mergeStandIn({ settings, fromId: 'stand-in-1', intoId: 'stand-in-2' }).problem).toBeTruthy();
    expect(mergeStandIn({ settings, fromId: 'stand-in-9', intoId: 'stand-in-1' }).problem).toBeTruthy();
    expect(mergeStandIn({ settings, fromId: 'stand-in-1', intoId: 'stand-in-1' }).problem).toBeTruthy();
    expect(mergeStandIn({ settings, fromId: 'stand-in-1', intoId: 'stand-in-2' }).settings).toBe(settings);
  });
});

describe('withRenamedStandIn', () => {
  it('gives the record another name and leaves everything else', () => {
    const settings = withRenamedStandIn({
      settings: settingsWith({ standIns: [standIn({ days: ['2026-09-11'] })] }),
      id: 'stand-in-1',
      name: '20260921 competition navigation rework',
    });

    expect(settings.standIns[0]?.name).toBe('20260921 competition navigation rework');
    expect(settings.standIns[0]?.days).toEqual(['2026-09-11']);
    expect(settings.attributionRules).toEqual(settingsWith().attributionRules);
  });

  it('trims the name it is given', () => {
    const settings = withRenamedStandIn({ settings: settingsWith(), id: 'stand-in-1', name: '  Journey  ' });

    expect(settings.standIns[0]?.name).toBe('Journey');
  });

  it('changes nothing for a blank name', () => {
    const settings = withRenamedStandIn({ settings: settingsWith(), id: 'stand-in-1', name: '   ' });

    expect(settings.standIns[0]?.name).toBe('Competition Journey');
  });

  it('changes nothing for an id it does not hold', () => {
    const settings = withRenamedStandIn({ settings: settingsWith(), id: 'stand-in-9', name: 'Journey' });

    expect(settings.standIns[0]?.name).toBe('Competition Journey');
  });
});

describe('withoutStandIn', () => {
  it('takes the rules that named it with it', () => {
    const settings = withoutStandIn({
      settings: settingsWith({ rules: [rule(), rule({ id: 'rule-2', target: { kind: 'donate' } })] }),
      id: 'stand-in-1',
    });

    expect(settings.standIns).toEqual([]);
    expect(settings.attributionRules.map((entry) => entry.id)).toEqual(['rule-2']);
  });

  it('refuses the branch of one the app opened, so the next pass writes no replacement', () => {
    const settings = withoutStandIn({
      settings: settingsWith({
        standIns: [standIn({ author: 'app', openedFor: '/home/tom/dev/ea-frontend', openedForBranch: 'feat/x' })],
      }),
      id: 'stand-in-1',
    });

    expect(settings.noStandInCheckouts).toEqual([{ repoPath: '/home/tom/dev/ea-frontend', branch: 'feat/x' }]);
  });

  it('reads the checkout off the rule where the record never recorded one', () => {
    const settings = withoutStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', openedForBranch: 'feat/x' })] }),
      id: 'stand-in-1',
    });

    expect(settings.noStandInCheckouts).toEqual([{ repoPath: '/home/tom/dev/ea-frontend', branch: 'feat/x' }]);
  });

  it('refuses only the directory of one opened for a directory of a base branch', () => {
    const settings = withoutStandIn({
      settings: settingsWith({
        standIns: [
          standIn({
            author: 'app',
            openedFor: '/home/tom/dev/ea-frontend',
            openedForBranch: 'develop',
            openedForWorkPath: 'specs/journey',
          }),
        ],
      }),
      id: 'stand-in-1',
    });

    expect(settings.noStandInCheckouts).toEqual([
      { repoPath: '/home/tom/dev/ea-frontend', branch: 'develop', workPath: 'specs/journey' },
    ]);
  });

  it('refuses nothing for one opened while the grain was the checkout, so the pass can redo it', () => {
    const settings = withoutStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', openedFor: '/home/tom/dev/ea-frontend' })] }),
      id: 'stand-in-1',
    });

    expect(settings.noStandInCheckouts).toEqual([]);
  });

  it('refuses nothing for one the user wrote, or one already resolved', () => {
    const user = withoutStandIn({ settings: settingsWith(), id: 'stand-in-1' });
    const resolved = withoutStandIn({
      settings: settingsWith({
        standIns: [standIn({ author: 'app', openedForBranch: 'feat/x', state: 'resolved', issueKey: 'FIP-1' })],
      }),
      id: 'stand-in-1',
    });

    expect(user.noStandInCheckouts).toEqual([]);
    expect(resolved.noStandInCheckouts).toEqual([]);
  });
});

describe('withStandInCheckoutAllowed', () => {
  it('takes the branch back off the refused list, and leaves another branch of it refused', () => {
    const refused = withoutStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', openedForBranch: 'feat/x' })] }),
      id: 'stand-in-1',
    });
    const both = {
      ...refused,
      noStandInCheckouts: [...refused.noStandInCheckouts, { repoPath: '/home/tom/dev/ea-frontend', branch: 'feat/y' }],
    };

    expect(
      withStandInCheckoutAllowed({ settings: both, repoPath: '/home/tom/dev/ea-frontend', branch: 'feat/x' })
        .noStandInCheckouts,
    ).toEqual([{ repoPath: '/home/tom/dev/ea-frontend', branch: 'feat/y' }]);
  });

  it('takes one directory off and leaves a sibling directory of the branch refused', () => {
    const sibling = { repoPath: '/home/tom/dev/ea-frontend', branch: 'develop', workPath: 'specs/other' };
    const refused = {
      ...settingsWith(),
      noStandInCheckouts: [
        { repoPath: '/home/tom/dev/ea-frontend', branch: 'develop', workPath: 'specs/journey' },
        sibling,
      ],
    };

    expect(
      withStandInCheckoutAllowed({
        settings: refused,
        repoPath: '/home/tom/dev/ea-frontend',
        branch: 'develop',
        workPath: 'specs/journey',
      }).noStandInCheckouts,
    ).toEqual([sibling]);
  });

  it('takes a whole-checkout entry off, which is what an older delete wrote', () => {
    const settings = settingsWith();
    const refused = { ...settings, noStandInCheckouts: [{ repoPath: '/home/tom/dev/ea-frontend' }] };

    expect(
      withStandInCheckoutAllowed({ settings: refused, repoPath: '/home/tom/dev/ea-frontend' }).noStandInCheckouts,
    ).toEqual([]);
  });
});

describe('withoutOrphanedStandIns', () => {
  it('drops one the app opened that no rule names any more', () => {
    const settings = withoutOrphanedStandIns(settingsWith({ standIns: [standIn({ author: 'app' })], rules: [] }));

    expect(settings.standIns).toEqual([]);
  });

  it('keeps one a rule still names, one the user wrote, and one already resolved', () => {
    const kept = settingsWith({
      standIns: [
        standIn({ author: 'app' }),
        standIn({ id: 'stand-in-2', author: 'user' }),
        standIn({ id: 'stand-in-3', author: 'app', state: 'resolved', issueKey: 'FIP-1' }),
      ],
    });

    expect(withoutOrphanedStandIns(kept).standIns.map((entry) => entry.id)).toEqual([
      'stand-in-1',
      'stand-in-2',
      'stand-in-3',
    ]);
  });
});

describe('withStandInsKeyedByHand', () => {
  const pin = { standInId: 'stand-in-1', issueKey: 'FIP-3006', sources: { issue: 'human' as const } };

  it('resolves the stand-in a row keyed by hand carries, as the user', () => {
    const settings = withStandInsKeyedByHand({ settings: settingsWith(), rows: [pin] });

    expect(settings.standIns[0]).toMatchObject({ state: 'resolved', issueKey: 'FIP-3006', resolutionSource: 'human' });
    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-3006' });
  });

  it('leaves it open for a key auto mode wrote', () => {
    const settings = settingsWith();

    expect(withStandInsKeyedByHand({ settings, rows: [{ ...pin, sources: { issue: 'auto' } }] })).toBe(settings);
  });

  it('leaves one the user reopened alone', () => {
    const settings = settingsWith({ standIns: [standIn({ resolutionSource: 'human' })] });

    expect(withStandInsKeyedByHand({ settings, rows: [pin] })).toBe(settings);
  });
});

describe('resolveStandIn', () => {
  it('points every rule that named it at the issue', () => {
    const settings = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'fip-100' });

    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
    expect(settings.standIns[0]?.state).toBe('resolved');
    expect(settings.standIns[0]?.issueKey).toBe('FIP-100');
  });

  it('leaves a rule that named another stand-in alone', () => {
    const other = rule({ id: 'rule-2', target: { kind: 'stand-in', standInId: 'stand-in-2' } });
    const settings = resolveStandIn({
      settings: settingsWith({ rules: [rule(), other] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });

    expect(standInIdOf(settings.attributionRules[1]!)).toBe('stand-in-2');
  });

  it('changes nothing for an id nothing holds', () => {
    const settings = settingsWith();

    expect(resolveStandIn({ settings, id: 'stand-in-2', issueKey: 'FIP-100' })).toBe(settings);
  });

  it('changes nothing when no issue is named', () => {
    const settings = settingsWith();

    expect(resolveStandIn({ settings, id: 'stand-in-1', issueKey: '  ' })).toBe(settings);
  });

  it('narrows a checkout-wide rule to the branch the placeholder was opened on', () => {
    const settings = resolveStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', heldOn: ['fix/player-name'] })] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });

    expect(settings.attributionRules).toHaveLength(1);
    expect(settings.attributionRules[0]?.branch).toBe('fix/player-name');
    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
  });

  it('leaves a branch the placeholder never saw unnamed', () => {
    const settings = resolveStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', heldOn: ['fix/player-name'] })] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });
    const later = matchAttributionRule({
      context: { repoPath: '/home/tom/dev/ea-frontend', branch: 'dev-player-name-auto-size' },
      rules: settings.attributionRules,
    });

    expect(later).toBeUndefined();
  });

  it('writes one rule per branch the placeholder was opened on', () => {
    const settings = resolveStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', heldOn: ['next', 'fix/player-name'] })] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });

    expect(settings.attributionRules.map((entry) => entry.branch)).toEqual(['next', 'fix/player-name']);
    expect(new Set(settings.attributionRules.map((entry) => entry.id)).size).toBe(2);
    expect(settings.standIns[0]?.resolvedRuleIds).toEqual(settings.attributionRules.map((entry) => entry.id));
  });

  it('leaves the rule of a stand-in the user wrote as wide as they wrote it', () => {
    const settings = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'FIP-100' });

    expect(settings.attributionRules).toHaveLength(1);
    expect(settings.attributionRules[0]?.id).toBe('rule-1');
    expect(settings.attributionRules[0]?.branch).toBeUndefined();
  });

  it('leaves a rule that already names a branch alone', () => {
    const settings = resolveStandIn({
      settings: settingsWith({
        standIns: [standIn({ author: 'app', heldOn: ['next'] })],
        rules: [rule({ branch: 'fix/player-name' })],
      }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });

    expect(settings.attributionRules).toHaveLength(1);
    expect(settings.attributionRules[0]?.branch).toBe('fix/player-name');
  });
});

describe('reopenStandIn', () => {
  it('points the rules it rewrote back at the stand-in', () => {
    const resolved = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'FIP-100' });
    const settings = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'stand-in', standInId: 'stand-in-1' });
    expect(settings.standIns[0]?.state).toBe('open');
    expect(settings.standIns[0]?.issueKey).toBeUndefined();
  });

  it('leaves a rule the user wrote against the same issue alone', () => {
    const own = rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-100' } });
    const resolved = resolveStandIn({
      settings: settingsWith({ rules: [rule(), own] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });
    const settings = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(settings.attributionRules[1]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
  });

  it('points the rules a narrowed resolve wrote back at the stand-in', () => {
    const resolved = resolveStandIn({
      settings: settingsWith({ standIns: [standIn({ author: 'app', heldOn: ['next', 'fix/player-name'] })] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });
    const settings = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(settings.attributionRules.map((entry) => entry.target)).toEqual([
      { kind: 'stand-in', standInId: 'stand-in-1' },
      { kind: 'stand-in', standInId: 'stand-in-1' },
    ]);
    expect(settings.standIns[0]?.state).toBe('open');
  });

  it('changes nothing for a stand-in that is still open', () => {
    const settings = settingsWith();

    expect(reopenStandIn({ settings, id: 'stand-in-1' })).toBe(settings);
  });
});

describe('withStandInIssue', () => {
  it('resolves an open stand-in as the user', () => {
    const settings = withStandInIssue({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'fip-100' });

    expect(settings.standIns[0]).toMatchObject({ state: 'resolved', issueKey: 'FIP-100', resolutionSource: 'human' });
    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
  });

  it('moves a resolved stand-in and the rules it rewrote to the new issue', () => {
    const resolved = resolveStandIn({
      settings: settingsWith(),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
      source: 'auto',
    });
    const settings = withStandInIssue({ settings: resolved, id: 'stand-in-1', issueKey: 'FIP-200' });

    expect(settings.standIns[0]).toMatchObject({ state: 'resolved', issueKey: 'FIP-200', resolutionSource: 'human' });
    expect(settings.attributionRules.map((entry) => entry.target)).toEqual([{ kind: 'issue', issueKey: 'FIP-200' }]);
  });

  it('leaves a rule the user wrote against the old issue alone', () => {
    const own = rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-100' } });
    const resolved = resolveStandIn({
      settings: settingsWith({ rules: [rule(), own] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });
    const settings = withStandInIssue({ settings: resolved, id: 'stand-in-1', issueKey: 'FIP-200' });

    expect(settings.attributionRules.map((entry) => entry.target)).toEqual([
      { kind: 'issue', issueKey: 'FIP-200' },
      { kind: 'issue', issueKey: 'FIP-100' },
    ]);
  });
});

describe('a resolve of a stand-in with days Tempo already holds', () => {
  const BOOKED = new Set(['2026-09-02', '2026-09-03']);
  const held = () => settingsWith({ standIns: [standIn({ days: ['2026-09-02', '2026-09-03', '2026-10-05'] })] });

  it('records the booked days it covers', () => {
    const settings = resolveStandIn({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-100', bookedDays: BOOKED });

    expect(settings.standIns[0]?.bookedDays).toEqual(['2026-09-02', '2026-09-03']);
  });

  it('records none when Tempo holds none of its days', () => {
    const settings = resolveStandIn({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-100', bookedDays: new Set() });

    expect(settings.standIns[0]?.bookedDays).toBeUndefined();
  });

  it('reads as open with its rule on a booked day, and as the issue on any other', () => {
    const settings = resolveStandIn({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-100', bookedDays: BOOKED });
    const booked = settingsOnDay({ settings, day: '2026-09-02' });
    const waiting = settingsOnDay({ settings, day: '2026-10-05' });

    expect(booked.standIns[0]).toMatchObject({ state: 'open', issueKey: undefined });
    expect(booked.attributionRules[0]?.target).toEqual({ kind: 'stand-in', standInId: 'stand-in-1' });
    expect(waiting).toBe(settings);
    expect(waiting.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
  });

  it('forgets the booked days once undone', () => {
    const resolved = resolveStandIn({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-100', bookedDays: BOOKED });

    expect(reopenStandIn({ settings: resolved, id: 'stand-in-1' }).standIns[0]?.bookedDays).toBeUndefined();
  });

  it('keeps the booked days of the first resolve when moved to another issue', () => {
    const resolved = resolveStandIn({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-100', bookedDays: BOOKED });
    const settings = withStandInIssue({
      settings: resolved,
      id: 'stand-in-1',
      issueKey: 'FIP-200',
      bookedDays: new Set([...BOOKED, '2026-10-05']),
    });

    expect(settings.standIns[0]).toMatchObject({ issueKey: 'FIP-200', bookedDays: ['2026-09-02', '2026-09-03'] });
  });

  it('records the booked days when an open one is resolved by its issue', () => {
    const settings = withStandInIssue({ settings: held(), id: 'stand-in-1', issueKey: 'FIP-200', bookedDays: BOOKED });

    expect(settings.standIns[0]?.bookedDays).toEqual(['2026-09-02', '2026-09-03']);
  });
});

describe('stand-in resolution source', () => {
  it('lets auto mode resolve a stand-in nobody decided yet, and marks the resolve as its own', () => {
    const settings = resolveStandIn({
      settings: settingsWith(),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
      source: 'auto',
    });

    expect(settings.standIns[0]?.state).toBe('resolved');
    expect(settings.standIns[0]?.resolutionSource).toBe('auto');
  });

  it('keeps auto mode from resolving a stand-in the user reopened', () => {
    const resolved = resolveStandIn({
      settings: settingsWith(),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
      source: 'auto',
    });
    const reopened = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(reopened.standIns[0]?.resolutionSource).toBe('human');
    expect(resolveStandIn({ settings: reopened, id: 'stand-in-1', issueKey: 'FIP-200', source: 'auto' })).toBe(
      reopened,
    );
  });

  it('keeps auto mode from reopening a stand-in the user resolved, stored without a source', () => {
    const settings = settingsWith({
      standIns: [standIn({ state: 'resolved', issueKey: 'FIP-100', resolvedRuleIds: ['rule-1'] })],
    });

    expect(reopenStandIn({ settings, id: 'stand-in-1', source: 'auto' })).toBe(settings);
  });
});

describe('withStandInResolutionReset', () => {
  it('hands a stand-in the user reopened back to auto mode', () => {
    const resolved = resolveStandIn({
      settings: settingsWith(),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
      source: 'auto',
    });
    const reopened = reopenStandIn({ settings: resolved, id: 'stand-in-1' });
    const reset = withStandInResolutionReset({ settings: reopened, id: 'stand-in-1' });

    expect(reset.standIns[0]?.resolutionSource).toBeUndefined();
    expect(
      resolveStandIn({ settings: reset, id: 'stand-in-1', issueKey: 'FIP-200', source: 'auto' }).standIns[0],
    ).toEqual(expect.objectContaining({ state: 'resolved', issueKey: 'FIP-200', resolutionSource: 'auto' }));
  });

  it('leaves a resolved stand-in alone', () => {
    const resolved = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'FIP-100' });

    expect(withStandInResolutionReset({ settings: resolved, id: 'stand-in-1' }).standIns).toEqual(resolved.standIns);
  });
});

describe('withStandInParent', () => {
  it('stores a parent auto mode picked, stamped auto', () => {
    const settings = withStandInParent({
      settings: settingsWith(),
      id: 'stand-in-1',
      parentKey: 'fip-9',
      source: 'auto',
    });

    expect(settings.standIns[0]).toEqual(expect.objectContaining({ parentKey: 'FIP-9', parentSource: 'auto' }));
  });

  it('keeps a parent the user picked from auto mode', () => {
    const picked = withStandInParent({ settings: settingsWith(), id: 'stand-in-1', parentKey: 'FIP-9' });

    expect(withStandInParent({ settings: picked, id: 'stand-in-1', parentKey: 'FIP-10', source: 'auto' })).toBe(picked);
  });

  it('keeps a parent stored without a source from auto mode, and clears it on an empty key', () => {
    const stored = settingsWith({ standIns: [standIn({ parentKey: 'FIP-9' })] });

    expect(withStandInParent({ settings: stored, id: 'stand-in-1', parentKey: 'FIP-10', source: 'auto' })).toBe(stored);
    expect(
      withStandInParent({ settings: stored, id: 'stand-in-1', parentKey: '' }).standIns[0]?.parentKey,
    ).toBeUndefined();
  });
});

describe('withStandInDay', () => {
  const BASE = ['next', 'main'];

  it('records the day once', () => {
    const once = withStandInDay({ settings: settingsWith(), id: 'stand-in-1', day: '2026-09-14' });
    const twice = withStandInDay({ settings: once, id: 'stand-in-1', day: '2026-09-14' });

    expect(twice.standIns[0]?.days).toEqual(['2026-09-14']);
  });

  it('collects the branches the day drew it on, so the resolve has a grain to cut to', () => {
    const settings = withStandInDay({
      settings: settingsWith(),
      id: 'stand-in-1',
      day: '2026-09-14',
      branches: ['feat/x', 'feat/y'],
      baseBranches: BASE,
    });

    expect(settings.standIns[0]?.heldOn).toEqual(['feat/x', 'feat/y']);
  });

  it('adds the branches a later day drew to the ones it already held', () => {
    const first = withStandInDay({
      settings: settingsWith(),
      id: 'stand-in-1',
      day: '2026-09-14',
      branches: ['feat/x'],
      baseBranches: BASE,
    });
    const settings = withStandInDay({
      settings: first,
      id: 'stand-in-1',
      day: '2026-09-15',
      branches: ['feat/x', 'feat/y'],
      baseBranches: BASE,
    });

    expect(settings.standIns[0]?.heldOn).toEqual(['feat/x', 'feat/y']);
    expect(settings.standIns[0]?.days).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('records no base branch, because integration work is not one piece of work', () => {
    const settings = withStandInDay({
      settings: settingsWith(),
      id: 'stand-in-1',
      day: '2026-09-14',
      branches: ['next', 'main', 'feat/x'],
      baseBranches: BASE,
    });

    expect(settings.standIns[0]?.heldOn).toEqual(['feat/x']);
  });

  it('leaves a checkout that only worked a base branch without a grain', () => {
    const settings = withStandInDay({
      settings: settingsWith(),
      id: 'stand-in-1',
      day: '2026-09-14',
      branches: ['next'],
      baseBranches: BASE,
    });

    expect(settings.standIns[0]?.heldOn).toBeUndefined();
  });
});

describe('withNamedStandIn', () => {
  const OPENED = standIn({ id: 'stand-in-2', name: 'The export nobody filed yet' });
  const NAMES_IT = rule({ id: 'rule-2', target: { kind: 'stand-in', standInId: OPENED.id } });

  it('writes the record and the rule that points at it in one value', () => {
    const settings = withNamedStandIn({
      settings: settingsWith({ standIns: [], rules: [] }),
      standIn: OPENED,
      rule: NAMES_IT,
    });

    expect(settings.standIns.map((entry) => entry.id)).toEqual([OPENED.id]);
    expect(settings.attributionRules.map(standInIdOf)).toEqual([OPENED.id]);
  });

  it('takes back the rule that answered the context before', () => {
    const answered = rule({ id: 'rule-donate', target: { kind: 'donate' } });
    const settings = withNamedStandIn({
      settings: settingsWith({ standIns: [], rules: [answered] }),
      standIn: OPENED,
      rule: NAMES_IT,
      supersededIds: [answered.id],
    });

    expect(settings.attributionRules.map((entry) => entry.id)).toEqual([NAMES_IT.id]);
  });

  it('keeps the rule of each directory piece on one branch, so no placeholder is swept', () => {
    const piece = (workPath: string) => ({
      standIn: standIn({ id: `stand-in:${workPath}`, author: 'app', openedFor: '/home/tom/dev/ea-frontend' }),
      rule: rule({
        id: `rule:${workPath}`,
        branch: 'next',
        workPath,
        author: 'app',
        target: { kind: 'stand-in', standInId: `stand-in:${workPath}` },
      }),
    });
    const settings = [piece('apps/web'), piece('libs/ui')].reduce(
      (held, next) => withNamedStandIn({ settings: held, ...next }),
      settingsWith({ standIns: [], rules: [] }),
    );

    expect(withoutOrphanedStandIns(settings).standIns.map((entry) => entry.id)).toEqual([
      'stand-in:apps/web',
      'stand-in:libs/ui',
    ]);
  });
});

describe('splitStandIn', () => {
  const wide = standIn({
    id: 'stand-in:1:specs',
    name: 'Competition journey spec frontend',
    author: 'app',
    openedFor: '/home/tom/dev/fifagg/specs',
    projectKey: 'FIFAGG',
    days: ['2026-09-08', '2026-09-09', '2026-09-11'],
    createdAt: new Date('2026-09-08T08:00:00.000Z'),
  });
  const wideRule = rule({
    id: 'repo:/home/tom/dev/fifagg/specs#1',
    repoPath: '/home/tom/dev/fifagg/specs',
    author: 'app',
    target: { kind: 'stand-in', standInId: 'stand-in:1:specs' },
  });
  const pieces = [
    { workPath: 'context/tracks/competition-journey', days: ['2026-09-08', '2026-09-09'] },
    { workPath: 'context/tracks/season-pass', days: ['2026-09-11'] },
  ];
  const now = new Date('2026-09-21T10:00:00.000Z');

  const split = (overrides: Partial<Parameters<typeof splitStandIn>[0]> = {}) =>
    splitStandIn({
      settings: settingsWith({ standIns: [wide], rules: [wideRule] }),
      id: 'stand-in:1:specs',
      branch: 'main',
      pieces,
      now,
      ...overrides,
    });

  it('opens one record per directory and takes the old one out', () => {
    const result = split();

    expect(result.refused).toBeUndefined();
    expect(result.settings.standIns).toHaveLength(2);
    expect(result.settings.standIns.map((entry) => entry.openedForWorkPath)).toEqual([
      'context/tracks/competition-journey',
      'context/tracks/season-pass',
    ]);
    expect(result.settings.standIns.every((entry) => entry.openedForBranch === 'main')).toBe(true);
  });

  it('moves each day onto the directory that worked in it', () => {
    expect(split().opened.map((entry) => entry.days)).toEqual([['2026-09-08', '2026-09-09'], ['2026-09-11']]);
  });

  it('keeps the age of the debt and the project it files into', () => {
    expect(split().opened.every((entry) => entry.createdAt.getTime() === wide.createdAt.getTime())).toBe(true);
    expect(split().opened.every((entry) => entry.projectKey === 'FIFAGG')).toBe(true);
  });

  it('rewrites the rule into one per directory, each naming the branch', () => {
    const rules = split().settings.attributionRules;

    expect(rules).toHaveLength(2);
    expect(rules.map((entry) => [entry.branch, entry.workPath])).toEqual([
      ['main', 'context/tracks/competition-journey'],
      ['main', 'context/tracks/season-pass'],
    ]);
    expect(rules.map((entry) => standInIdOf(entry))).toEqual(split().opened.map((entry) => entry.id));
  });

  it('gives each rule the directory scope, so one directory no longer answers for the other', () => {
    const rules = split().settings.attributionRules;
    const match = matchAttributionRule({
      context: { repoPath: '/home/tom/dev/fifagg/specs', branch: 'main', workPath: 'context/tracks/season-pass' },
      rules,
    });

    expect(match?.rule.workPath).toBe('context/tracks/season-pass');
  });

  it('takes the record it split out even when a day of it is left with no directory', () => {
    const result = split({ pieces: [pieces[0]!, { workPath: 'context/tracks/season-pass', days: ['2026-09-30'] }] });

    expect(result.refused).toBeUndefined();
    expect(result.remainder).toEqual(['2026-09-11']);
    expect(result.settings.standIns.some((standIn) => standIn.id === 'stand-in:1:specs')).toBe(false);
  });

  it('leaves no rule covering the whole checkout behind, so a later branch can open its own', () => {
    const result = split({ pieces: [pieces[0]!, { workPath: 'context/tracks/season-pass', days: ['2026-09-30'] }] });

    expect(result.settings.attributionRules.filter((rule) => !rule.branch)).toEqual([]);
    expect(result.settings.attributionRules.filter((rule) => !!rule.workPath)).toHaveLength(2);
  });

  it('reports no remainder once every day it held has a directory', () => {
    const result = split({ pieces });

    expect(result.remainder).toEqual([]);
  });

  it('gives a day no commit claims to the directory the caller names', () => {
    const thin = [pieces[0]!, { workPath: 'context/tracks/season-pass', days: ['2026-09-30'] }];
    const result = split({ pieces: thin, claim: 'context/tracks/season-pass' });

    expect(result.refused).toBeUndefined();
    expect(result.opened[1]?.days).toEqual(['2026-09-11', '2026-09-30']);
  });

  it('opens a piece for a claimed directory the commits never named', () => {
    const thin = [pieces[0]!, { workPath: 'context/tracks/season-pass', days: ['2026-09-30'] }];
    const result = split({ pieces: thin, claim: 'context/tracks/overlay' });

    expect(result.refused).toBeUndefined();
    expect(result.opened.map((standIn) => standIn.openedForWorkPath)).toContain('context/tracks/overlay');
    expect(result.opened.at(-1)?.days).toEqual(['2026-09-11']);
  });

  it('refuses a claim when every day of the record already has a directory', () => {
    expect(split({ claim: 'context/tracks/nowhere' }).refused).toContain('can claim none');
  });

  it('refuses a single directory, which is the whole checkout under another name', () => {
    expect(split({ pieces: [pieces[0]!] }).refused).toContain('two directories or more');
  });

  it('refuses a record that names no checkout and was given none', () => {
    const result = split({ settings: settingsWith({ standIns: [standIn({ id: 'stand-in:1:specs' })], rules: [] }) });

    expect(result.refused).toContain('names no checkout');
  });

  it('splits a record that names no checkout when the caller names one', () => {
    const result = split({
      settings: settingsWith({ standIns: [standIn({ id: 'stand-in:1:specs' })], rules: [] }),
      repoPath: '/home/tom/dev/fifagg/specs',
    });

    expect(result.refused).toBeUndefined();
    expect(result.opened.map((entry) => entry.openedFor)).toEqual([
      '/home/tom/dev/fifagg/specs',
      '/home/tom/dev/fifagg/specs',
    ]);
  });

  it('names each piece after its directory unless the caller says otherwise', () => {
    expect(split().opened.map((entry) => entry.name)).toEqual(['Competition journey', 'Season pass']);
    expect(split({ pieces: [{ ...pieces[0]!, name: 'Journey spec' }, pieces[1]!] }).opened[0]?.name).toBe(
      'Journey spec',
    );
  });
});

describe('withStandInsHidden', () => {
  it('hides the open stand-ins named as of the day given, and shows them again on an empty day', () => {
    const settings = settingsWith({
      standIns: [
        standIn(),
        standIn({ id: 'stand-in-2' }),
        standIn({ id: 'stand-in-3', state: 'resolved', issueKey: 'FIP-1' }),
      ],
    });

    const hidden = withStandInsHidden({ settings, ids: ['stand-in-1', 'stand-in-3'], day: '2026-09-29' });

    expect(hidden.standIns.map((entry) => entry.hiddenOn)).toEqual(['2026-09-29', undefined, undefined]);
    expect(withStandInsHidden({ settings: hidden, ids: ['stand-in-1'], day: '' }).standIns[0]).not.toHaveProperty(
      'hiddenOn',
    );
  });
});

describe('reading back a stand-in the app named after a note that does not read as words', () => {
  it('renames it after where the work happened, and keeps every other record as written', () => {
    const clicked = standIn({
      id: 'stand-in-2',
      name: '(click)=',
      description: 'What the work says it was:\n\n- (click)=\n\nCovers main.',
      author: 'app',
      openedFor: '/home/tom/dev/ea-frontend',
      openedForBranch: 'main',
    });
    const settings = parseTimetrackSettings({
      standIns: [standIn(), clicked],
      attributionRules: [rule({ target: { kind: 'stand-in', standInId: 'stand-in-2' } })],
    });

    expect(settings.standIns.map(({ name, description }) => ({ name, description }))).toEqual([
      { name: 'Competition Journey', description: undefined },
      {
        name: 'ea-frontend',
        description: 'Nothing in the day names this work beyond where it happened.\n\nCovers main.',
      },
    ]);
  });
});
