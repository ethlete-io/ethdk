import { DesignChange, designChanges$ } from './design-changes';
import { resetDesignStreams } from './design-events';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  private listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.set(name, (this.listeners.get(name) ?? new Set()).add(listener));
  }

  removeEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.get(name)?.delete(listener);
  }

  close() {
    return undefined;
  }

  emit(name: string) {
    this.listeners.get(name)?.forEach((listener) => listener(new Event(name)));
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('designChanges$ reconnects', () => {
  let pids: (number | 'refused')[];

  beforeEach(() => {
    FakeEventSource.instances = [];
    pids = [];
    resetDesignStreams();
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', async () => {
      const pid = pids.shift() ?? 'refused';

      if (pid === 'refused') throw new TypeError('Failed to fetch');

      return new Response(JSON.stringify({ pid }));
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const reconnect = async () => {
    FakeEventSource.instances[0]!.emit('error');
    FakeEventSource.instances[0]!.emit('open');
    await settle();
  };

  it('relists without redrawing frames when the same server comes back, and redraws for another one', async () => {
    const changes: DesignChange[] = [];

    pids = [100, 100, 200, 200];
    const subscription = designChanges$(4402).subscribe((change) => changes.push(change));

    await settle();
    FakeEventSource.instances[0]!.emit('open');
    await settle();
    expect(changes).toEqual([]);

    await reconnect();
    expect(changes).toEqual([{ kind: 'relisted' }]);

    await reconnect();
    expect(changes).toEqual([{ kind: 'relisted' }, { kind: 'all' }]);

    await reconnect();
    expect(changes).toEqual([{ kind: 'relisted' }, { kind: 'all' }, { kind: 'relisted' }]);

    subscription.unsubscribe();
  });

  it('redraws when the server pid cannot be read', async () => {
    const changes: DesignChange[] = [];

    pids = [100, 'refused'];
    const subscription = designChanges$(4402).subscribe((change) => changes.push(change));

    await settle();
    await reconnect();
    expect(changes).toEqual([{ kind: 'all' }]);

    subscription.unsubscribe();
  });
});
