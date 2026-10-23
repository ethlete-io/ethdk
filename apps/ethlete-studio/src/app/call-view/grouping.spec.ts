import { Call, CallVariant } from '../../host/design';
import {
  callList,
  defaultVariant,
  featureGroups,
  inventoryProgress,
  inventoryRows,
  isSystemCall,
  LOOSE_FEATURE,
  projectSummaries,
  ruledLabel,
  settledGroups,
  stageGroups,
  stageLabel,
  stageOverview,
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
  stage: null,
  inventory: [],
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

describe('stageGroups', () => {
  it('groups open calls by stage in the design order, loose calls last', () => {
    const groups = stageGroups({
      calls: [
        call('p/a', { touched: 3 }),
        call('p/b', { stage: 'page', touched: 2 }),
        call('p/c', { stage: 'themes' }),
        call('p/d', { stage: 'page', touched: 5 }),
        settled('p/e', { stage: 'ci' }),
      ],
      project: '',
      term: '',
    });

    expect(groups.map((group) => [group.stage, group.calls.map((entry) => entry.slug)])).toEqual([
      ['themes', ['p/c']],
      ['page', ['p/d', 'p/b']],
      [null, ['p/a']],
    ]);
  });
});

describe('stageGroups with an unknown stage', () => {
  it('keeps the raw id, after the known stages and before the loose calls', () => {
    const groups = stageGroups({
      calls: [call('p/a'), call('p/b', { stage: 'sketch' as never }), call('p/c', { stage: 'page' })],
      project: '',
      term: '',
    });

    expect(groups.map((group) => group.stage)).toEqual(['page', 'sketch', null]);
  });
});

describe('stageLabel', () => {
  it('numbers a stage by its place in the order and keeps an unknown id', () => {
    expect(stageLabel('themes')).toBe('1 Foundations');
    expect(stageLabel('prototype')).toBe('7 Prototype');
    expect(stageLabel('sketch')).toBe('sketch');
  });
});

describe('stageOverview', () => {
  it('counts open, ready and settled calls for every stage, the empty ones too', () => {
    const overview = stageOverview(
      {
        calls: [
          call('p/a', { stage: 'page' }),
          call('p/b', { stage: 'page' }),
          settled('p/c', { stage: 'page' }),
          call('p/d', { stage: 'ci' }),
        ],
        project: '',
        term: '',
      },
      { 'p/a': 'ready', 'p/d': 'drawing' },
    );

    expect(overview).toHaveLength(7);
    expect(overview.find((entry) => entry.stage === 'page')).toEqual({ stage: 'page', open: 2, ready: 1, settled: 1 });
    expect(overview.find((entry) => entry.stage === 'ci')).toEqual({ stage: 'ci', open: 1, ready: 0, settled: 0 });
    expect(overview.find((entry) => entry.stage === 'themes')).toEqual({
      stage: 'themes',
      open: 0,
      ready: 0,
      settled: 0,
    });
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

describe('the design system and the inventory', () => {
  const wireframe = call('p/wire', {
    stage: 'wireframe',
    inventory: [
      { part: 'Search', sdk: 'et-input', new: false, call: null },
      { part: 'Card', sdk: null, new: true, call: 'p/components/card' },
      { part: 'Badge', sdk: null, new: true, call: 'p/components/badge' },
    ],
  });
  const calls = [wireframe, call('p/components/card', { stage: 'component' })];

  it('keeps the calls of the design system out of the lists', () => {
    const system = call('p/system/button');

    expect(isSystemCall(system)).toBe(true);
    expect(callList({ calls: [system, call('p/a')], project: 'p', term: '' }).map((entry) => entry.slug)).toEqual([
      'p/a',
    ]);
  });

  it('marks which component calls of the inventory exist', () => {
    expect(inventoryRows(calls, 'p').map((row) => row.exists)).toEqual([false, true, false]);
  });

  it('counts the new parts that have a call', () => {
    expect(inventoryProgress(inventoryRows(calls, 'p'))).toBe('1 of 2 parts have a call');
    expect(inventoryProgress([])).toBeNull();
  });
});
