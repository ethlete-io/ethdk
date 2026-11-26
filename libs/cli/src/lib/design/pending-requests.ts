type CdpSession = {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  on?: (event: string, listener: (params: never) => void) => unknown;
};

type TrackedPage = { context: () => { newCDPSession: (page: never) => Promise<CdpSession> } };

type Pending = { url: string; since: number };

const trackers = new WeakMap<object, Promise<Map<string, Pending> | null>>();

const track = async (page: TrackedPage) => {
  const session = await page.context().newCDPSession(page as never);

  if (typeof session.on !== 'function') return null;

  const pending = new Map<string, Pending>();
  const settle = ({ requestId }: { requestId: string }) => pending.delete(requestId);

  session.on('Network.requestWillBeSent', ({ requestId, request }: { requestId: string; request: { url: string } }) =>
    pending.set(requestId, { url: request.url, since: Date.now() }),
  );
  session.on('Network.loadingFinished', settle);
  session.on('Network.loadingFailed', settle);
  await session.send('Network.enable');

  return pending;
};

/**
 * Starts recording the network requests of `page` and its same-process frames that started and neither finished nor
 * failed. Call before the navigation whose requests `pendingRequestsOf` should name; a second call is a no-op.
 */
export const trackPendingRequests = async (page: object) => {
  if (!trackers.has(page))
    trackers.set(
      page,
      track(page as TrackedPage).catch(() => null),
    );

  await trackers.get(page);
};

/** The requests `trackPendingRequests` saw start on `page` that are still open, oldest first, as `<url> (<age> ms)`;
 * `null` for a page it does not track. */
export const pendingRequestsOf = async (page: object) => {
  const pending = await trackers.get(page);

  if (!pending) return null;

  const now = Date.now();

  return [...pending.values()].sort((a, b) => a.since - b.since).map(({ url, since }) => `${url} (${now - since} ms)`);
};

/** A clause naming the open requests of `page` for a timeout message, or an empty string for an untracked page. */
export const pendingRequestsLineOf = async (page: object) => {
  const open = await pendingRequestsOf(page);

  if (open === null) return '';

  return open.length === 0 ? ' - no request was still open' : ` - requests still open: ${open.join(', ')}`;
};
