import { Call, CallVariant } from '../../host/design';
import {
  callList,
  defaultVariant,
  featureGroups,
  LOOSE_FEATURE,
  projectSummaries,
  ruledLabel,
  settledGroups,
  touchedLabel,
  unsettledCalls,
} from './grouping';

const variant = (key: string, patch: Partial<CallVariant> = {}): CallVariant => ({
  key,
  name: key,
  round: null,
  verdict: null,
  claim: '',
  cost: '',
  ...patch,
});

const call = (slug: string, patch: Partial<Call> = {}): Call => ({
  slug,
  feature: null,
  eyebrow: '',
  headline: slug,
  intro: '',
  frameWidth: 800,
  mode: 'design',
  handoff: false,
  touched: 0,
  rounds: [],
  variants: [variant('a')],
  ...patch,
});

const settled = (slug: string, patch: Partial<Call> = {}) =>
  call(slug, { variants: [variant('a', { verdict: 'chosen' })], ...patch });

describe('callList', () => {
  const calls = [call('shop/b', { eyebrow: 'Cart' }), call('shop/a'), call('blog/a', { headline: 'Comments' })];

  it('keeps every call for an empty project and term, by name', () => {
    expect(callList({ calls, project: '', term: '' }).map((entry) => entry.slug)).toEqual([
      'blog/a',
      'shop/a',
      'shop/b',
    ]);
  });

  it('filters by project and by a trimmed, case-insensitive term', () => {
    expect(callList({ calls, project: 'shop', term: '  CART ' }).map((entry) => entry.slug)).toEqual(['shop/b']);
    expect(callList({ calls, project: '', term: 'comments' }).map((entry) => entry.slug)).toEqual(['blog/a']);
  });

  it('treats a whitespace-only term as empty', () => {
    expect(callList({ calls, project: 'shop', term: '   ' })).toHaveLength(2);
  });

  it('does not mutate the input', () => {
    const input = [call('b'), call('a')];

    callList({ calls: input, project: '', term: '' });

    expect(input.map((entry) => entry.slug)).toEqual(['b', 'a']);
  });

  it('puts a slug without a folder in a project of its own', () => {
    expect(callList({ calls: [call('solo')], project: 'solo', term: '' })).toHaveLength(1);
  });
});

describe('unsettledCalls', () => {
  it('drops settled calls and sorts the rest by most recent', () => {
    const calls = [call('a', { touched: 1 }), settled('b', { touched: 9 }), call('c', { touched: 5 })];

    expect(unsettledCalls({ calls, project: '', term: '' }).map((entry) => entry.slug)).toEqual(['c', 'a']);
  });
});

describe('ruledLabel', () => {
  it('counts ruled variants', () => {
    expect(ruledLabel(call('a', { variants: [variant('a', { verdict: 'rejected' }), variant('b')] }))).toBe(
      '1 of 2 ruled',
    );
    expect(ruledLabel(call('a', { variants: [] }))).toBe('0 of 0 ruled');
  });
});

describe('defaultVariant', () => {
  it('picks the first open variant', () => {
    expect(defaultVariant(call('a', { variants: [variant('x', { verdict: 'chosen' }), variant('y')] }))).toBe('y');
  });

  it('picks the winner of the latest round when nothing is open', () => {
    const rounds = [
      { key: 'r1', title: '' },
      { key: 'r2', title: '' },
    ];
    const variants = [
      variant('late', { round: 'r2', verdict: 'chosen' }),
      variant('early', { round: 'r1', verdict: 'chosen' }),
      variant('lost', { round: 'r2', verdict: 'rejected' }),
    ];

    expect(defaultVariant(call('a', { rounds, variants }))).toBe('late');
  });

  it('falls back to the first variant, then to an empty key', () => {
    expect(defaultVariant(call('a', { variants: [variant('x', { verdict: 'rejected' })] }))).toBe('x');
    expect(defaultVariant(call('a', { variants: [] }))).toBe('');
  });
});

describe('touchedLabel', () => {
  const now = 1_000_000;

  it('prints nothing for a call that was never written', () => {
    expect(touchedLabel(0, now)).toBe('');
  });

  it('clamps a time in the future to just now', () => {
    expect(touchedLabel(now + 500, now)).toBe('just now');
  });

  it('uses singular and plural units', () => {
    expect(touchedLabel(now - 60, now)).toBe('1 minute ago');
    expect(touchedLabel(now - 120, now)).toBe('2 minutes ago');
    expect(touchedLabel(now - 3600, now)).toBe('1 hour ago');
    expect(touchedLabel(now - 30 * 3600, now)).toBe('yesterday');
    expect(touchedLabel(now - 3 * 86400, now)).toBe('3 days ago');
    expect(touchedLabel(now - 7 * 86400, now)).toBe('1 week ago');
  });

  it('never rounds up into the next unit', () => {
    expect(touchedLabel(now - 3590, now)).toBe('59 minutes ago');
    expect(touchedLabel(now - (86400 - 60), now)).toBe('23 hours ago');
    expect(touchedLabel(now - (7 * 86400 - 60), now)).toBe('6 days ago');
  });
});

describe('featureGroups', () => {
  it('groups by feature, loose calls last, and counts open calls', () => {
    const calls = [
      call('p/a', { feature: 'Zeta' }),
      call('p/b'),
      settled('p/c', { feature: 'Alpha' }),
      call('p/d', { feature: 'Alpha' }),
    ];

    expect(
      featureGroups({ calls, project: '', term: '' }).map(({ name, open, calls: entries }) => [
        name,
        open,
        entries.length,
      ]),
    ).toEqual([
      ['Alpha', 1, 2],
      ['Zeta', 1, 1],
      [LOOSE_FEATURE, 1, 1],
    ]);
  });

  it('treats an empty feature name as loose', () => {
    expect(featureGroups({ calls: [call('a', { feature: '' })], project: '', term: '' })[0]?.name).toBe(LOOSE_FEATURE);
  });

  it('returns no group for no calls', () => {
    expect(featureGroups({ calls: [], project: '', term: '' })).toEqual([]);
  });
});

describe('settledGroups', () => {
  it('keeps only calls without an open variant, including calls without variants', () => {
    const calls = [call('a'), settled('b'), call('c', { variants: [] })];

    expect(settledGroups({ calls, project: '', term: '' })[0]?.calls.map((entry) => entry.slug)).toEqual(['b', 'c']);
  });
});

describe('projectSummaries', () => {
  it('summarises each project by name', () => {
    expect(projectSummaries([call('b/x'), settled('a/y'), call('a/z')])).toEqual([
      { name: 'a', calls: 2, open: 1 },
      { name: 'b', calls: 1, open: 1 },
    ]);
  });
});
