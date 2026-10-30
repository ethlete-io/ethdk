import { commentChanges$ } from './design';
import { DesignChange, designChanges$ } from './design-changes';
import { designEvents$, resetDesignStreams } from './design-events';
import { flowChanges$ } from './design-flows';
import { noteChanges$ } from './design-notes';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
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
    this.closed = true;
  }

  emit(name: string, data?: string) {
    this.listeners.get(name)?.forEach((listener) => listener(Object.assign(new Event(name), { data })));
  }
}

const first = () => FakeEventSource.instances[0]!;

describe('the shared design event stream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    resetDesignStreams();
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens one EventSource for every host function and closes it with the last unsubscribe', () => {
    const subscriptions = [
      commentChanges$(1).subscribe({ error: () => undefined }),
      designChanges$(1).subscribe(),
      noteChanges$(1).subscribe(),
      flowChanges$(1).subscribe(),
    ];

    expect(FakeEventSource.instances).toHaveLength(1);

    subscriptions.slice(0, 3).forEach((subscription) => subscription.unsubscribe());
    expect(first().closed).toBe(false);

    subscriptions[3]?.unsubscribe();
    expect(first().closed).toBe(true);
  });

  it('reopens for the next subscriber', () => {
    designEvents$(1, 'notes').subscribe().unsubscribe();
    designEvents$(1, 'notes').subscribe();

    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('routes each event name to its own function', () => {
    const notes = vi.fn();
    const flows = vi.fn();
    const comments = vi.fn();

    noteChanges$(1).subscribe(notes);
    flowChanges$(1).subscribe(flows);
    commentChanges$(1).subscribe({ next: comments, error: () => undefined });

    first().emit('notes');

    expect(notes).toHaveBeenCalledTimes(1);
    expect(flows).not.toHaveBeenCalled();
    expect(comments).not.toHaveBeenCalled();
  });

  it('tells a late comment subscriber the stream is connected, and errors them when it drops', () => {
    const early = vi.fn();
    const late = vi.fn();
    const lateError = vi.fn();

    designChanges$(1).subscribe();
    first().emit('open');

    commentChanges$(1).subscribe({ next: late, error: lateError });
    expect(late).toHaveBeenCalledWith('connected');

    commentChanges$(1).subscribe({ next: early, error: () => undefined });
    first().emit('error');

    expect(lateError).toHaveBeenCalledTimes(1);
  });

  it('names a call, sketch or parts change, and reads all again after a reconnect or an unreadable parts event', () => {
    const changes: DesignChange[] = [];

    designChanges$(1).subscribe((change) => changes.push(change));
    first().emit('open');
    first().emit('calls', '{}');
    first().emit('sketches', '{}');
    first().emit('parts', '{"revision":2,"all":false,"parts":[]}');
    first().emit('comments', '{}');
    first().emit('parts', 'not json');
    first().emit('error');
    first().emit('open');

    expect(changes).toEqual([
      { kind: 'calls' },
      { kind: 'sketches' },
      { kind: 'parts', change: { revision: 2, all: false, parts: [] } },
      { kind: 'all' },
      { kind: 'all' },
    ]);
  });
});
