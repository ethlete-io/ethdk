import { describe, expect, it, vi } from 'vitest';
import { DesignConfig } from './design-config';
import { DesignServer, drawingOn, DrawQueue, WarmDraw } from './warm-draw';

const own = vi.hoisted(() => ({ serverClosed: vi.fn(), queueClosed: vi.fn() }));

vi.mock('./serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: own.serverClosed,
    httpServer: { address: () => ({ port: 4001 }) },
  }),
}));
vi.mock('./thumb', () => ({ createDrawQueue: () => ({ close: own.queueClosed }) }));

const options = { target: '/nowhere', config: {} as DesignConfig };

describe('drawingOn', () => {
  it('draws on the warm server and Chromium and leaves both open', async () => {
    const close = vi.fn();
    const server = { close, httpServer: { address: () => ({ port: 4002 }) } } as unknown as DesignServer;
    const queue = { close } as unknown as DrawQueue;
    const warm: WarmDraw = { server: async () => server, queue: () => queue };

    const drawn = await drawingOn({ ...options, warm }, async (drawing) => drawing);

    expect(drawn).toEqual({ server, queue, base: 'http://localhost:4002' });
    expect(close).not.toHaveBeenCalled();
  });

  it('closes a server and Chromium of its own after the draw, also when it throws', async () => {
    await expect(
      drawingOn(options, async () => {
        throw new Error('drawn wrong');
      }),
    ).rejects.toThrow('drawn wrong');

    expect(own.serverClosed).toHaveBeenCalledOnce();
    expect(own.queueClosed).toHaveBeenCalledOnce();
  });
});
