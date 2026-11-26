import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBroadcastChannelHandle, flushMultiTabSync, installFakeBroadcastChannel } from '@ethlete/query/testing';
import { QUERY_SYNC_PROTOCOL_VERSION } from './query-sync-message';
import { createQuerySyncTransport } from './query-sync-transport';

describe('createQuerySyncTransport', () => {
  let bus: FakeBroadcastChannelHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
  });

  afterEach(() => {
    bus.restore();
  });

  it('should send a message to another tab on the same channel', async () => {
    const tabA = createQuerySyncTransport('test');
    const tabB = createQuerySyncTransport('test');
    const received = vi.fn();

    tabB.listen(received);
    tabA.post({ type: 'mutation', method: 'PUT', url: 'https://example.com/players/1' });

    await flushMultiTabSync();

    expect(received).toHaveBeenCalledWith({ type: 'mutation', method: 'PUT', url: 'https://example.com/players/1' });

    tabA.destroy();
    tabB.destroy();
  });

  it('should not deliver a message back to the tab that posted it', async () => {
    const tabA = createQuerySyncTransport('test');
    const received = vi.fn();

    tabA.listen(received);
    tabA.post({ type: 'response', key: '1', body: { a: 1 }, expiresAt: null });

    await flushMultiTabSync();

    expect(received).not.toHaveBeenCalled();

    tabA.destroy();
  });

  it('should not deliver a message across channel names', async () => {
    const tabA = createQuerySyncTransport('client-a');
    const tabB = createQuerySyncTransport('client-b');
    const received = vi.fn();

    tabB.listen(received);
    tabA.post({ type: 'response', key: '1', body: null, expiresAt: null });

    await flushMultiTabSync();

    expect(received).not.toHaveBeenCalled();

    tabA.destroy();
    tabB.destroy();
  });

  it('should stamp the protocol version on outgoing messages', () => {
    const tabA = createQuerySyncTransport('test');

    tabA.post({ type: 'response', key: '1', body: null, expiresAt: 5 });

    expect(bus.posted).toEqual([
      {
        channel: 'test',
        data: { v: QUERY_SYNC_PROTOCOL_VERSION, type: 'response', key: '1', body: null, expiresAt: 5 },
      },
    ]);

    tabA.destroy();
  });

  it('should ignore a message from a foreign protocol version', async () => {
    const tabA = new BroadcastChannel('test');
    const tabB = createQuerySyncTransport('test');
    const received = vi.fn();

    tabB.listen(received);
    tabA.postMessage({ v: QUERY_SYNC_PROTOCOL_VERSION + 1, type: 'mutation', method: 'POST', url: '/players' });

    await flushMultiTabSync();

    expect(received).not.toHaveBeenCalled();

    tabA.close();
    tabB.destroy();
  });

  it('should ignore a payload that is not one of our messages', async () => {
    const tabA = new BroadcastChannel('test');
    const tabB = createQuerySyncTransport('test');
    const received = vi.fn();

    tabB.listen(received);
    tabA.postMessage('hello from an extension');
    tabA.postMessage({ v: QUERY_SYNC_PROTOCOL_VERSION, type: 'response' });
    tabA.postMessage({ v: QUERY_SYNC_PROTOCOL_VERSION, type: 'something-else' });

    await flushMultiTabSync();

    expect(received).not.toHaveBeenCalled();

    tabA.close();
    tabB.destroy();
  });

  it('should fan out to every listener and stop after unlisten', async () => {
    const tabA = createQuerySyncTransport('test');
    const tabB = createQuerySyncTransport('test');
    const first = vi.fn();
    const second = vi.fn();

    const unlisten = tabB.listen(first);
    tabB.listen(second);

    tabA.post({ type: 'mutation', method: 'POST', url: '/players' });
    await flushMultiTabSync();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unlisten();
    tabA.post({ type: 'mutation', method: 'POST', url: '/players' });
    await flushMultiTabSync();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    tabA.destroy();
    tabB.destroy();
  });

  it('should stop receiving after destroy', async () => {
    const tabA = createQuerySyncTransport('test');
    const tabB = createQuerySyncTransport('test');
    const received = vi.fn();

    tabB.listen(received);
    tabB.destroy();

    tabA.post({ type: 'mutation', method: 'POST', url: '/players' });
    await flushMultiTabSync();

    expect(received).not.toHaveBeenCalled();

    tabA.destroy();
  });

  it('should swallow a body that cannot be structured cloned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tabA = createQuerySyncTransport('test');

    expect(() => tabA.post({ type: 'response', key: '1', body: { fn: () => 1 }, expiresAt: null })).not.toThrow();
    expect(warn).toHaveBeenCalled();

    tabA.destroy();
    warn.mockRestore();
  });

  it('should be an inert no-op without BroadcastChannel', () => {
    bus.restore();

    const original = globalThis.BroadcastChannel;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).BroadcastChannel;

    const transport = createQuerySyncTransport('test');

    expect(transport.isSupported).toBe(false);
    expect(() => transport.post({ type: 'mutation', method: 'POST', url: '/players' })).not.toThrow();
    expect(() => transport.listen(vi.fn())()).not.toThrow();
    expect(() => transport.destroy()).not.toThrow();

    globalThis.BroadcastChannel = original;
  });
});
