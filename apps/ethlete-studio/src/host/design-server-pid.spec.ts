import { resetDesignStreams } from './design-events';
import { designServerReplaced$ } from './design-server-pid';

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

describe('designServerReplaced$', () => {
  let answers: (number | 'refused' | object)[];
  let asked: string[];

  beforeEach(() => {
    FakeEventSource.instances = [];
    asked = [];
    answers = [];
    resetDesignStreams();
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(String(url));
      const answer = answers.shift() ?? 'refused';

      if (answer === 'refused') throw new TypeError('Failed to fetch');

      return new Response(JSON.stringify(typeof answer === 'number' ? { pid: answer } : answer));
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('emits when the stream reconnects to another server process, not for the first one or the same one', async () => {
    let replaced = 0;

    answers = [100, 100, 200];
    const subscription = designServerReplaced$(4402).subscribe(() => replaced++);

    await settle();
    expect(asked).toEqual(['http://localhost:4402/__design/stamp']);

    FakeEventSource.instances[0]!.emit('open');
    await settle();
    expect(replaced).toBe(0);

    FakeEventSource.instances[0]!.emit('error');
    FakeEventSource.instances[0]!.emit('open');
    await settle();
    expect(replaced).toBe(1);

    subscription.unsubscribe();
  });

  it('skips a refused read and a server that reports no pid', async () => {
    let replaced = 0;

    answers = ['refused', {}, 100, 100];
    const subscription = designServerReplaced$(4402).subscribe(() => replaced++);

    for (let open = 0; open < 3; open++) {
      await settle();
      FakeEventSource.instances[0]!.emit('open');
    }
    await settle();

    expect(asked).toHaveLength(4);
    expect(replaced).toBe(0);

    subscription.unsubscribe();
  });
});
