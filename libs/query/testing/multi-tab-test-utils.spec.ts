import { flushMultiTabSync, installFakeWebLocks, type FakeWebLocksHandle } from './multi-tab-test-utils';

describe('installFakeWebLocks', () => {
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    locks.restore();
  });

  const spyOnSignal = (signal: AbortSignal) => ({
    added: vi.spyOn(signal, 'addEventListener'),
    removed: vi.spyOn(signal, 'removeEventListener'),
  });

  it('drops the abort listener of every granted request that settled', async () => {
    const controller = new AbortController();
    const { added, removed } = spyOnSignal(controller.signal);

    for (let i = 0; i < 5; i++) {
      await navigator.locks.request('leader', { signal: controller.signal }, () => Promise.resolve());
    }

    expect(added).toHaveBeenCalledTimes(5);
    expect(removed).toHaveBeenCalledTimes(5);
  });

  it('drops the abort listener of a request that was aborted while queued', async () => {
    const holderController = new AbortController();
    const queuedController = new AbortController();
    const { added, removed } = spyOnSignal(queuedController.signal);

    let releaseHolder!: () => void;
    const holderReleased = new Promise<void>((resolve) => (releaseHolder = resolve));
    const holder = navigator.locks.request('leader', { signal: holderController.signal }, () => holderReleased);

    await flushMultiTabSync();

    const queued = navigator.locks
      .request('leader', { signal: queuedController.signal }, () => Promise.resolve())
      .catch((error: unknown) => error);

    await flushMultiTabSync();
    queuedController.abort();

    await expect(queued).resolves.toMatchObject({ name: 'AbortError' });
    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);

    releaseHolder();
    await holder;
  });

  it('drops the abort listener of an ifAvailable request that was handed null', async () => {
    const holderController = new AbortController();
    const tryController = new AbortController();
    const { added, removed } = spyOnSignal(tryController.signal);

    let releaseHolder!: () => void;
    const holderReleased = new Promise<void>((resolve) => (releaseHolder = resolve));
    const holder = navigator.locks.request('leader', { signal: holderController.signal }, () => holderReleased);

    await flushMultiTabSync();

    const lock = await navigator.locks.request(
      'leader',
      { ifAvailable: true, signal: tryController.signal },
      (granted) => granted,
    );

    expect(lock).toBeNull();
    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);

    releaseHolder();
    await holder;
  });

  it('drops the abort listener of a request still queued when the fake is uninstalled', async () => {
    const holderController = new AbortController();
    const queuedController = new AbortController();
    const { added, removed } = spyOnSignal(queuedController.signal);

    let releaseHolder!: () => void;
    const holderReleased = new Promise<void>((resolve) => (releaseHolder = resolve));
    const holder = navigator.locks.request('leader', { signal: holderController.signal }, () => holderReleased);

    await flushMultiTabSync();

    void navigator.locks
      .request('leader', { signal: queuedController.signal }, () => Promise.resolve())
      .catch(() => undefined);

    await flushMultiTabSync();

    locks.restore();
    locks = installFakeWebLocks();

    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);

    releaseHolder();
    await holder;
  });
});
