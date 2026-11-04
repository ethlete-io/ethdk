import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkVisibleChange } from '../visible-change-command';
import { VisibleChangeVerdict } from '../visible-change';
import { visibleChangeProblemsOf } from './visible-change';

vi.mock('../visible-change-command', () => ({ checkVisibleChange: vi.fn() }));

const verdictOf = (overrides: Partial<VisibleChangeVerdict>): VisibleChangeVerdict => ({
  part: 'pages/system',
  pass: true,
  why: 'invisible',
  changed: [],
  unjudged: [],
  reasons: [],
  undrivable: [],
  undrivableReasons: [],
  ...overrides,
});

const problemsFor = async (verdict: VisibleChangeVerdict, line: string) => {
  vi.mocked(checkVisibleChange).mockImplementation(async (options) => {
    options.onVerdict?.({ product: 'studio', verdict, line });

    return 0;
  });

  return visibleChangeProblemsOf({
    target: '/repo',
    config: { products: {} },
    product: 'studio',
    harnessMap: 'harness.ts',
    base: 'abc',
  });
};

describe('visibleChangeProblemsOf', () => {
  beforeEach(() => {
    vi.mocked(checkVisibleChange).mockReset();
  });

  it('reports a state the app cannot be driven into on a passing part', async () => {
    const problems = await problemsFor(
      verdictOf({
        undrivable: ['part-focus-visible'],
        undrivableReasons: ['the harness page has no element with the button "49 offen" to force focus-visible on'],
      }),
      'PASS pages/system: no visible change',
    );

    expect(problems.get('pages/system')).toEqual([
      {
        rule: 'VISIBLE-CHANGE',
        file: 'harness.ts',
        message:
          '1 state(s) the app cannot be driven into (part-focus-visible): the harness page has no element with the button "49 offen" to force focus-visible on',
      },
    ]);
  });

  it('reports nothing for a passing part every state of which the app draws', async () => {
    expect((await problemsFor(verdictOf({}), 'PASS pages/system: no visible change')).size).toBe(0);
  });
});
