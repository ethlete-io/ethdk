import { slowCaseProblemOf } from './test-slow-case';

describe('slowCaseProblemOf', () => {
  it('fails a local case that uses more than half of its timeout', () => {
    expect(slowCaseProblemOf({ elapsedMs: 2600, timeoutMs: 5000, ci: false })).toBe(
      'the case took 2600 ms of its 5000 ms timeout - move a one-time cost (a cold compile) into beforeAll, or make the case faster',
    );
  });

  it('passes a local case at half of its timeout or below', () => {
    expect(slowCaseProblemOf({ elapsedMs: 2500, timeoutMs: 5000, ci: false })).toBeNull();
  });

  it('passes every case in CI', () => {
    expect(slowCaseProblemOf({ elapsedMs: 4900, timeoutMs: 5000, ci: true })).toBeNull();
  });
});
