import { repoRootOf } from '../src/lib/model/context';
import { buildBusyDay, syntheticBusyDay } from './busy-day';

describe('a busy day', () => {
  it('builds its rows from 50k events within a second', () => {
    const input = syntheticBusyDay();
    const started = performance.now();
    const { review } = buildBusyDay(input);

    expect(review.rows.length).toBeGreaterThan(0);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('files a path under the roots it is asked with, not under ones an earlier call passed', () => {
    const path = '/home/me/dev/outer/inner/src';

    expect(repoRootOf({ path, roots: ['/home/me/dev/outer'] })).toBe('/home/me/dev/outer');
    expect(repoRootOf({ path, roots: ['/home/me/dev/outer', '/home/me/dev/outer/inner'] })).toBe(
      '/home/me/dev/outer/inner',
    );
    expect(repoRootOf({ path, roots: [] })).toBe(path);
  });
});
