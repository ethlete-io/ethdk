import { describe, expect, it } from 'vitest';
import { pendingRequestsLineOf, trackPendingRequests } from './pending-requests';

const pageOf = () => {
  const listeners = new Map<string, (params: unknown) => void>();
  const session = {
    send: async () => undefined,
    on: (event: string, listener: (params: unknown) => void) => listeners.set(event, listener),
  };
  const emit = (event: string, params: unknown) => listeners.get(event)?.(params);

  return { page: { context: () => ({ newCDPSession: async () => session }) }, emit };
};

describe('pending requests', () => {
  it('names the requests that started and neither finished nor failed', async () => {
    const { page, emit } = pageOf();

    await trackPendingRequests(page);
    emit('Network.requestWillBeSent', { requestId: '1', request: { url: 'http://d/frame.ts' } });
    emit('Network.requestWillBeSent', { requestId: '2', request: { url: 'http://d/hung.ts' } });
    emit('Network.requestWillBeSent', { requestId: '3', request: { url: 'http://d/gone.ts' } });
    emit('Network.loadingFinished', { requestId: '1' });
    emit('Network.loadingFailed', { requestId: '3' });

    expect(await pendingRequestsLineOf(page)).toMatch(/^ - requests still open: http:\/\/d\/hung\.ts \(\d+ ms\)$/);
  });

  it('says no request was open when every one settled', async () => {
    const { page, emit } = pageOf();

    await trackPendingRequests(page);
    emit('Network.requestWillBeSent', { requestId: '1', request: { url: 'http://d/frame.ts' } });
    emit('Network.loadingFinished', { requestId: '1' });

    expect(await pendingRequestsLineOf(page)).toBe(' - no request was still open');
  });

  it('adds nothing for a page it cannot track', async () => {
    const page = { context: () => ({ newCDPSession: async () => ({ send: async () => undefined }) }) };

    await trackPendingRequests(page);

    expect(await pendingRequestsLineOf(page)).toBe('');
    expect(await pendingRequestsLineOf({})).toBe('');
  });
});
