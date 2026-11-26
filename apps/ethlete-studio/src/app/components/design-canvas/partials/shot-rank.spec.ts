import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShownShots } from '../../../../host/design';
import { ShotBoard } from './shot-rank';

const SHOT = 'http://localhost:4402/__design/shot?product=p&part=a&state=s&priority=low';
const OTHER = 'http://localhost:4402/__design/shot?product=p&part=b&state=s&priority=low';

const posted = () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

  return () => fetch.mock.calls.map(([url, init]) => ({ url, ...(JSON.parse(String(init?.body)) as ShownShots) }));
};

describe('ShotBoard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts the mounted shots once per change, the page switch as one view', async () => {
    const calls = posted();
    const board = new ShotBoard();
    const hideShot = board.show(SHOT, true);

    board.show('http://localhost:4402/frame.html?part=a', false);
    await Promise.resolve();

    hideShot();
    board.show(OTHER, false);
    await Promise.resolve();

    const [first, second] = calls();

    expect(calls()).toHaveLength(2);
    expect(first).toMatchObject({ url: 'http://localhost:4402/__design/view', shown: [SHOT], active: [SHOT] });
    expect(second).toMatchObject({ shown: [OTHER], active: [] });
    expect(second?.view).toBeGreaterThan(first?.view ?? Infinity);
  });

  it('posts nothing when a remount leaves the shots as they were', async () => {
    const calls = posted();
    const board = new ShotBoard();

    board.show(SHOT, false)();
    board.show(SHOT, false);
    await Promise.resolve();
    board.show(SHOT, false)();
    await Promise.resolve();

    expect(calls()).toHaveLength(1);
  });
});
