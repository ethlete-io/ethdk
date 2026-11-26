import { watchFrameworkWarnings } from './test-framework-warnings';

describe('watchFrameworkWarnings', () => {
  it('reports NG0 warnings, clears them once taken and lets other warnings pass', () => {
    const logged: unknown[][] = [];
    const target = { warn: (...args: unknown[]) => logged.push(args) };
    const take = watchFrameworkWarnings(target);

    target.warn('plain warning');

    expect(take()).toBeNull();

    target.warn('NG0953: Unexpected emit for destroyed `OutputRef`.');

    expect(take()).toBe('the test logged Angular warnings:\n  NG0953: Unexpected emit for destroyed `OutputRef`.');
    expect(take()).toBeNull();
    expect(logged).toHaveLength(2);
  });
});
