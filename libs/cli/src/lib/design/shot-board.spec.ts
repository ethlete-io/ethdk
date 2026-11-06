import { IncomingMessage, ServerResponse } from 'http';
import { PassThrough } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { createShotBoard, shotKeyOf, shotViewMiddleware } from './shot-board';
import { DRAWS_AT_ONCE, createDrawQueue } from './thumb';

const SHOT = 'http://localhost:4402/__design/shot?product=p&part=a&state=s&priority=low';
const OTHER = 'http://localhost:4402/__design/shot?product=p&part=b&state=s&priority=low';

describe('shotKeyOf', () => {
  it('drops the ranking params and the param order', () => {
    expect(shotKeyOf(`${SHOT}&view=5&rank=active`)).toBe(shotKeyOf('/__design/shot?state=s&part=a&product=p'));
    expect(shotKeyOf(SHOT)).not.toBe(shotKeyOf(OTHER));
  });
});

describe('createShotBoard', () => {
  it('places an ask by the last view shown and ignores an older view', () => {
    const board = createShotBoard();
    const asked = { key: shotKeyOf(SHOT), boardView: board.view() };

    expect(board.laneOf(asked)).toBeNull();
    expect(board.show({ view: 2, shown: [SHOT], active: [] })).toBe(true);
    expect(board.laneOf(asked)).toBe(2);
    expect(board.show({ view: 3, shown: [OTHER], active: [SHOT] })).toBe(true);
    expect(board.laneOf(asked)).toBe(1);
    expect(board.show({ view: 1, shown: [], active: [] })).toBe(false);
    expect(board.show({ view: 4, shown: [OTHER], active: [] })).toBe(true);
    expect(board.laneOf(asked)).toBe(4);
    expect(board.laneOf({ key: shotKeyOf(SHOT), boardView: 4 })).toBeNull();
  });
});

describe('shotViewMiddleware', () => {
  const post = (board: ReturnType<typeof createShotBoard>, body: string) =>
    new Promise<number>((done) => {
      const request = Object.assign(new PassThrough(), { method: 'POST' });
      const response = { statusCode: 200, setHeader: vi.fn(), end: () => done(response.statusCode) };

      shotViewMiddleware(board)(request as unknown as IncomingMessage, response as unknown as ServerResponse);
      request.end(body);
    });

  it('shows a posted view and refuses a malformed one', async () => {
    const board = createShotBoard();

    expect(await post(board, JSON.stringify({ view: 7, shown: [SHOT], active: [] }))).toBe(204);
    expect(board.view()).toBe(7);
    expect(await post(board, '{"view":8}')).toBe(400);
    expect(await post(board, 'nope')).toBe(400);
    expect(board.view()).toBe(7);
  });
});

describe('a draw queue with a shot board', () => {
  it('draws the shots of the shown view first, also when the view is posted after the asks', async () => {
    const board = createShotBoard();
    const launch = vi.fn(async () => ({ close: async () => undefined }));
    const queue = createDrawQueue({
      target: '/co',
      chromiumOf: async () => ({ chromium: { launch } as never, from: 'x' }),
      board,
    });
    const order: string[] = [];
    let release = () => undefined as void;
    const held = new Promise<void>((done) => (release = done));
    const busy = Array.from({ length: DRAWS_AT_ONCE }, () => queue.run(async () => held, 'low'));
    const want = (url: string) => ({
      priority: 'low' as const,
      board: { key: shotKeyOf(url), boardView: board.view() },
    });
    const drawn = [
      queue.run(async () => void order.push('old'), want(OTHER)),
      queue.run(async () => void order.push('plain'), 'low'),
      queue.run(async () => void order.push('shown'), want(SHOT)),
    ];

    board.show({ view: 1, shown: [SHOT], active: [] });
    release();
    await Promise.all([...busy, ...drawn]);

    expect(order).toEqual(['shown', 'plain', 'old']);
  });
});
