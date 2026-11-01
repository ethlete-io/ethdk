import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, Subscriber, of, throwError } from 'rxjs';
import { CommentEvent, ListedComment, ListedComments, ProductAddress } from '../../host/design';
import { rememberedView } from '../studio-view/remembered';
import { CommentSource, injectCommentStore, provideCommentStore } from './comment-store';

const host = vi.hoisted(() => ({
  list: vi.fn<(address: ProductAddress) => Observable<ListedComments>>(),
  changes: vi.fn<(port: number) => Observable<CommentEvent>>(),
}));

vi.mock('../../host/design', () => ({
  listedComments$: host.list,
  commentChanges$: host.changes,
}));

const listed = (id: string, createdAt: string): ListedComment => ({
  id,
  part: 'components/card',
  state: 'empty',
  size: 'phone',
  text: `text ${id}`,
  createdAt,
  replies: [],
  threadState: 'agent',
  stale: null,
});

const ADDRESS = { port: 4492, product: 'shop' };

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideCommentStore()] });
  const store = TestBed.runInInjectionContext(() => injectCommentStore());
  const source = signal<CommentSource>({ address: ADDRESS, revision: 0 });

  store.connect(source);
  TestBed.tick();

  return { store, source };
};

describe('CommentStore', () => {
  let changes: Subject<CommentEvent>;
  let stored: ListedComment[];

  beforeEach(() => {
    changes = new Subject();
    stored = [listed('b', '2026-10-27T10:00:02Z'), listed('a', '2026-10-27T10:00:01Z')];
    host.list.mockReset().mockImplementation(() => of({ comments: [...stored], unreadable: [] }));
    host.changes.mockReset().mockReturnValue(changes);
  });

  it('numbers the comments oldest first and reloads them on a comment change and a new revision', () => {
    const { store, source } = setup();

    expect(store.comments().map((comment) => [comment.id, comment.number])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(host.changes).toHaveBeenCalledWith(4492);

    stored = [listed('a', '2026-10-27T10:00:01Z')];
    changes.next('changed');
    TestBed.tick();
    expect(store.comments().map((comment) => comment.id)).toEqual(['a']);

    source.set({ address: ADDRESS, revision: 1 });
    TestBed.tick();
    expect(host.list).toHaveBeenCalledTimes(3);
    expect(host.changes).toHaveBeenCalledTimes(1);
  });

  it('keeps resolved threads out of the open comments and remembers whether the sidebar shows them', () => {
    localStorage.clear();
    stored = [
      ...stored,
      {
        ...listed('c', '2026-10-27T10:00:00Z'),
        resolved: { by: 'user', resolvedAt: '2026-10-28T09:00:00Z' },
      },
    ];

    const { store } = setup();

    expect(store.comments().map((comment) => [comment.id, comment.number])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(store.resolved().map((comment) => comment.id)).toEqual(['c']);
    expect(store.resolvedShown()).toBe(false);

    store.showResolved(true);

    expect(store.resolvedShown()).toBe(true);
    expect(rememberedView().resolvedShown).toBe(true);
    localStorage.clear();
  });

  it('keeps the last list and sets the error when a later list request fails, then recovers on retry', () => {
    const { store } = setup();

    host.list.mockReturnValueOnce(throwError(() => new Error('offline')));
    changes.next('changed');
    TestBed.tick();

    expect(store.comments().map((comment) => comment.id)).toEqual(['a', 'b']);
    expect(store.loaded()).toBe(true);
    expect(store.loadError()).toBe('offline');

    store.retry();
    TestBed.tick();

    expect(store.loadError()).toBe('');
    expect(store.comments()).toHaveLength(2);
  });

  it('shows the error instead of an empty inbox when the first load fails', () => {
    host.list.mockReturnValue(throwError(() => new Error('offline')));
    const { store } = setup();

    expect(store.comments()).toEqual([]);
    expect(store.loaded()).toBe(false);
    expect(store.loadError()).toBe('offline');

    host.list.mockImplementation(() => of({ comments: [], unreadable: [] }));
    store.retry();
    TestBed.tick();

    expect(store.loaded()).toBe(true);
    expect(store.loadError()).toBe('');
  });

  it('reports an interrupted live connection and reconnects on retry', () => {
    host.changes.mockReturnValueOnce(throwError(() => new Error('closed')));
    const { store } = setup();

    expect(store.interrupted()).toBe(true);

    store.retry();
    TestBed.tick();

    expect(host.changes).toHaveBeenCalledTimes(2);
    expect(store.interrupted()).toBe(false);
  });

  it('reports a dropped live connection, reconnects by itself and reloads the list', () => {
    vi.useFakeTimers();

    const streams: Subscriber<CommentEvent>[] = [];

    host.changes.mockReturnValue(new Observable<CommentEvent>((subscriber) => void streams.push(subscriber)));
    const { store } = setup();

    streams[0]?.next('connected');
    TestBed.tick();
    const loads = host.list.mock.calls.length;

    streams[0]?.error(new Error('dropped'));
    TestBed.tick();

    expect(store.interrupted()).toBe(true);

    vi.advanceTimersByTime(5000);
    streams[1]?.next('connected');
    TestBed.tick();

    expect(streams).toHaveLength(2);
    expect(store.interrupted()).toBe(false);
    expect(host.list.mock.calls.length).toBe(loads + 1);

    vi.useRealTimers();
  });
});
