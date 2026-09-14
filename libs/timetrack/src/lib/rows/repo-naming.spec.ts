import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { TimetrackProjectLink } from '../model/project-link';
import { HistoricalWorklog } from '../model/recurrence';
import { NamedCheckout, repoNamingDecisions, repoNamingOffers } from './repo-naming';

const SDK = '/home/tom/dev/ethlete-sdk';

const checkout = (overrides: Partial<NamedCheckout> = {}): NamedCheckout => ({
  repoPath: SDK,
  branches: ['next'],
  observedMs: 2 * 60 * 60_000,
  ...overrides,
});

const link = (overrides: Partial<TimetrackProjectLink> = {}): TimetrackProjectLink => ({
  id: 'link-1',
  path: SDK,
  target: { kind: 'project', projectKey: 'ET' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: SDK,
  branch: 'next',
  target: { kind: 'donate' },
  author: 'user',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const worklog = (issueKey: string, day: number, hours: number): HistoricalWorklog => ({
  issueKey,
  from: new Date(`2026-09-${String(day).padStart(2, '0')}T09:00:00Z`),
  durationMs: hours * 60 * 60_000,
});

/** Six days on the project's standing task, which is what the SDK checkout files into. */
const DOMINANT: HistoricalWorklog[] = [
  worklog('ET-772', 1, 4),
  worklog('ET-772', 2, 5),
  worklog('ET-772', 3, 3),
  worklog('ET-772', 4, 6),
  worklog('ET-772', 5, 4),
  worklog('ET-772', 8, 5),
];

describe('repoNamingOffers', () => {
  it('offers the issue a checkout project spent nearly all of its time on', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: DOMINANT,
      loggedIssues: [{ issueKey: 'ET-772', summary: 'SDK work' }],
    });

    expect(offers).toHaveLength(1);
    expect(offers[0]?.issueKey).toBe('ET-772');
    expect(offers[0]?.repoPath).toBe(SDK);
    expect(offers[0]?.projectKey).toBe('ET');
    expect(offers[0]?.days).toBe(6);
    expect(offers[0]?.summary).toBe('SDK work');
    expect(offers[0]?.share).toBe(1);
  });

  it('carries the donating rule it replaces, which would otherwise win over the rule it writes', () => {
    const donating = rule();
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [donating],
      worklogs: DOMINANT,
    });

    expect(offers[0]?.supersedes).toEqual([donating]);
  });

  it('carries every donating rule of the branches the day saw', () => {
    const onNext = rule({ id: 'rule-next', branch: 'next' });
    const onMain = rule({ id: 'rule-main', branch: 'main' });
    const offers = repoNamingOffers({
      checkouts: [checkout({ branches: ['next', 'main'] })],
      links: [link()],
      rules: [onNext, onMain],
      worklogs: DOMINANT,
    });

    expect(offers[0]?.supersedes.map((entry) => entry.id)).toEqual(['rule-next', 'rule-main']);
  });

  it('offers nothing when one branch of the checkout carries a deliberate answer', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout({ branches: ['next', 'main'] })],
      links: [link()],
      rules: [
        rule({ id: 'rule-next', branch: 'next' }),
        rule({ id: 'rule-main', branch: 'main', target: { kind: 'issue', issueKey: 'ET-900' } }),
      ],
      worklogs: DOMINANT,
    });

    expect(offers).toEqual([]);
  });

  it('offers nothing for a context a rule already names an issue for', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [rule({ target: { kind: 'issue', issueKey: 'ET-900' } })],
      worklogs: DOMINANT,
    });

    expect(offers).toEqual([]);
  });

  it('offers nothing when the project spread its time over many issues', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [
        worklog('ET-772', 1, 4),
        worklog('ET-772', 2, 4),
        worklog('ET-772', 3, 4),
        worklog('ET-100', 1, 5),
        worklog('ET-200', 2, 5),
        worklog('ET-300', 3, 5),
      ],
    });

    expect(offers).toEqual([]);
  });

  it('ranks by time rather than by how often an issue was logged', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [
        ...DOMINANT,
        worklog('ET-10', 1, 0.1),
        worklog('ET-11', 2, 0.1),
        worklog('ET-12', 3, 0.1),
        worklog('ET-13', 4, 0.1),
      ],
    });

    expect(offers[0]?.issueKey).toBe('ET-772');
  });

  it('offers nothing on one long afternoon, because a habit needs more than one day', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [worklog('ET-772', 1, 4), worklog('ET-772', 1, 4)],
    });

    expect(offers).toEqual([]);
  });

  it('offers nothing when the project holds too little time for a share to mean anything', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [worklog('ET-772', 1, 0.5), worklog('ET-772', 2, 0.5), worklog('ET-772', 3, 0.5)],
    });

    expect(offers).toEqual([]);
  });

  it('offers nothing for a checkout no link files into a project', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link({ target: { kind: 'private' } })],
      rules: [],
      worklogs: DOMINANT,
    });

    expect(offers).toEqual([]);
  });

  it('offers nothing for a stream that is no checkout at all', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout({ repoPath: '' })],
      links: [link()],
      rules: [],
      worklogs: DOMINANT,
    });

    expect(offers).toEqual([]);
  });

  it('reads a link on the directory above the checkout, the way attribution does', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link({ path: '/home/tom/dev' })],
      rules: [],
      worklogs: DOMINANT,
    });

    expect(offers[0]?.issueKey).toBe('ET-772');
  });

  it('does not confuse one project key with another that starts the same way', () => {
    const offers = repoNamingOffers({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [...DOMINANT.map((entry) => ({ ...entry, issueKey: 'ETX-1' })), worklog('ET-1', 1, 1)],
    });

    expect(offers).toEqual([]);
  });
});

describe('repoNamingDecisions', () => {
  const reasonFor = (options: Parameters<typeof repoNamingDecisions>[0]) =>
    repoNamingDecisions(options).declines[0]?.reason;

  it('names the rule that already answered the checkout', () => {
    expect(
      reasonFor({
        checkouts: [checkout()],
        links: [link()],
        rules: [rule({ target: { kind: 'issue', issueKey: 'ET-900' } })],
        worklogs: DOMINANT,
      }),
    ).toBe('already-named');
  });

  it('names the missing link when nothing says which project the checkout files into', () => {
    expect(reasonFor({ checkouts: [checkout()], links: [], rules: [], worklogs: DOMINANT })).toBe('no-project-link');
  });

  it('separates a project the span logged nothing for from one it logged too little for', () => {
    expect(reasonFor({ checkouts: [checkout()], links: [link()], rules: [], worklogs: [] })).toBe('no-history');
    expect(
      reasonFor({ checkouts: [checkout()], links: [link()], rules: [], worklogs: [worklog('ET-772', 1, 1)] }),
    ).toBe('project-too-small');
  });

  it('names the threshold a project that logged enough still misses', () => {
    expect(
      reasonFor({
        checkouts: [checkout()],
        links: [link()],
        rules: [],
        worklogs: [worklog('ET-772', 1, 5), worklog('ET-772', 2, 5)],
      }),
    ).toBe('too-few-days');

    expect(
      reasonFor({
        checkouts: [checkout()],
        links: [link()],
        rules: [],
        worklogs: [...DOMINANT.slice(0, 3), worklog('ET-31', 6, 9), worklog('ET-32', 7, 9)],
      }),
    ).toBe('share-too-low');
  });

  it('measures what a decline fell short of, so a reader need not guess', () => {
    const [decline] = repoNamingDecisions({
      checkouts: [checkout()],
      links: [link()],
      rules: [],
      worklogs: [...DOMINANT.slice(0, 3), worklog('ET-31', 6, 12)],
    }).declines;

    expect(decline).toMatchObject({ repoPath: SDK, projectKey: 'ET', issueKey: 'ET-31', days: 1 });
    expect(decline?.projectMs).toBe(24 * 60 * 60_000);
  });

  it('reports nothing as declined when the checkout is offered', () => {
    const decisions = repoNamingDecisions({ checkouts: [checkout()], links: [link()], rules: [], worklogs: DOMINANT });

    expect(decisions.offers).toHaveLength(1);
    expect(decisions.declines).toHaveLength(0);
    expect(repoNamingOffers({ checkouts: [checkout()], links: [link()], rules: [], worklogs: DOMINANT })).toEqual(
      decisions.offers,
    );
  });
});
