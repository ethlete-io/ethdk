import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, Subscriber, of, throwError } from 'rxjs';
import { CommentEvent, DesignAnswerError, ListedComment, ListedComments, ProductAddress } from '../../host/design';
import { rememberedView } from '../studio-view/remembered';
import { CommentSource, injectCommentStore, provideCommentStore } from './comment-store';

const host = vi.hoisted(() => ({
  list: vi.fn<(address: ProductAddress) => Observable<ListedComments>>(),
  changes: vi.fn<(port: number) => Observable<CommentEvent>>(),
  write: vi.fn<(address: ProductAddress, comment: unknown) => Observable<ListedComment>>(),
  reply: vi.fn<(address: ProductAddress, reply: unknown) => Observable<ListedComment>>(),
  resolve: vi.fn<(address: ProductAddress, id: string) => Observable<{ id: string }>>(),
  withdraw: vi.fn<(address: ProductAddress, withdrawn: { id: string; reply?: number }) => Observable<{ id: string }>>(),
}));

vi.mock('../../host/design', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../host/design')>()),
  listedComments$: host.list,
  commentChanges$: host.changes,
  writeComment$: host.write,
  replyToComment$: host.reply,
  resolveComment$: host.resolve,
  withdrawComment$: host.withdraw,
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

  describe('working on a thread', () => {
    it('sends the trimmed reply, clears it and reloads; a failed one keeps it with the error phase', () => {
      const { store } = setup();
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const loads = host.list.mock.calls.length;

      host.reply.mockReset().mockReturnValue(of(listed('a', '2026-10-27T10:00:01Z')));
      store.replyText.set('  Passt  ');
      store.reply('a', store.replyText());

      expect(host.reply).toHaveBeenCalledWith(ADDRESS, { id: 'a', text: 'Passt' });
      TestBed.tick();
      expect(store.replyText()).toBe('');
      expect(store.replyPhase()).toBeNull();
      expect(host.list.mock.calls.length).toBe(loads + 1);

      host.reply.mockReset().mockReturnValue(throwError(() => new DesignAnswerError('kaputt', 500)));
      store.replyText.set('Passt');
      store.reply('a', 'Passt');
      expect(store.replyPhase()).toBe('error');
      expect(store.replyText()).toBe('Passt');

      host.reply.mockReset().mockReturnValue(throwError(() => new DesignAnswerError('no open comment a', 404)));
      store.reply('a', 'Passt');
      expect(store.replyPhase()).toBe('rejected');
      expect(store.replyReason()).toBe('no open comment a');

      store.clearReply();
      expect(store.replyText()).toBe('');
      expect(store.replyPhase()).toBeNull();
      logged.mockRestore();
    });

    it('resolves and withdraws a thread, then reloads the list', () => {
      const { store } = setup();
      const loads = host.list.mock.calls.length;

      host.resolve.mockReset().mockReturnValue(of({ id: 'a' }));
      host.withdraw.mockReset().mockReturnValue(of({ id: 'b' }));
      store.resolve('a');
      store.withdraw('b');
      store.withdraw('b', 1);
      TestBed.tick();

      expect(host.resolve).toHaveBeenCalledWith(ADDRESS, 'a');
      expect(host.withdraw).toHaveBeenCalledWith(ADDRESS, { id: 'b' });
      expect(host.withdraw).toHaveBeenCalledWith(ADDRESS, { id: 'b', reply: 1 });
      expect(host.list.mock.calls.length).toBe(loads + 1);
    });
  });

  describe('writing a comment', () => {
    const DRAFT = {
      frameId: 'f',
      place: { part: 'components/card', state: 'empty', size: 'phone' },
      point: { x: 10.4, y: 20.6 },
    };

    it('writes the trimmed text at the rounded point, closes the draft and reloads, comment mode stays on', () => {
      const { store } = setup();
      const written = new Subject<ListedComment>();

      host.write.mockReset().mockReturnValue(written);
      store.toggle();
      store.start(DRAFT);
      store.send('  Zu eng  ');

      expect(host.write).toHaveBeenCalledWith(ADDRESS, {
        part: 'components/card',
        state: 'empty',
        size: 'phone',
        point: { x: 10, y: 21 },
        text: 'Zu eng',
      });
      expect(store.sendPhase()).toBe('busy');

      store.cancel();
      expect(store.draft()).toEqual(DRAFT);

      const loads = host.list.mock.calls.length;

      written.next(listed('c', '2026-10-27T10:00:03Z'));
      TestBed.tick();

      expect(store.sendPhase()).toBeNull();
      expect(store.draft()).toBeNull();
      expect(store.active()).toBe(true);
      expect(host.list.mock.calls.length).toBe(loads + 1);
    });

    it('keeps the draft and its text after a failed send and shows the error phase', () => {
      const { store } = setup();
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      host.write.mockReset().mockReturnValue(throwError(() => new Error('offline')));
      store.toggle();
      store.start(DRAFT);
      store.draftText.set('Zu eng');
      store.send(store.draftText());

      expect(store.sendPhase()).toBe('error');
      expect(store.draft()).toEqual(DRAFT);
      expect(store.draftText()).toBe('Zu eng');
      expect(logged).toHaveBeenCalledTimes(1);
      logged.mockRestore();
    });

    it('offers a retry after a server error and shows the reason of a refused send without one', () => {
      const { store } = setup();
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      store.toggle();
      store.start(DRAFT);
      host.write.mockReset().mockReturnValue(throwError(() => new DesignAnswerError('kaputt', 500)));
      store.send('Zu eng');

      expect(store.sendPhase()).toBe('error');
      expect(store.sendReason()).toBe('');

      host.write.mockReset().mockReturnValue(throwError(() => new DesignAnswerError('part gone', 422)));
      store.send('Zu eng');

      expect(store.sendPhase()).toBe('rejected');
      expect(store.sendReason()).toBe('part gone');
      expect(store.draft()).toEqual(DRAFT);

      store.cancel();

      expect(store.sendReason()).toBe('');
      expect(logged).toHaveBeenCalledTimes(2);
      logged.mockRestore();
    });

    it('ends comment mode and drops the draft on a second toggle', () => {
      const { store } = setup();

      store.toggle();
      store.start(DRAFT);
      store.toggle();

      expect(store.active()).toBe(false);
      expect(store.draft()).toBeNull();
    });

    it('discards an open draft on Esc first, then leaves comment mode on the next Esc', () => {
      const { store } = setup();

      expect(store.escape()).toBe(false);

      store.toggle();
      store.start(DRAFT);

      expect(store.escape()).toBe(true);
      expect(store.draft()).toBeNull();
      expect(store.active()).toBe(true);

      expect(store.escape()).toBe(true);
      expect(store.active()).toBe(false);
    });
  });
});
