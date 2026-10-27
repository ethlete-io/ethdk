import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CommentPlace, ListedComment, ListedComments, ProductAddress } from '../../host/design';
import { CommentSource, injectCommentStore, provideCommentStore } from './comment-store';

const host = vi.hoisted(() => ({
  list: vi.fn<(address: ProductAddress) => Observable<ListedComments>>(),
  write: vi.fn<(address: ProductAddress, comment: CommentPlace & { text: string }) => Observable<unknown>>(),
  done: vi.fn<(address: ProductAddress, id: string) => Observable<void>>(),
  changes: vi.fn<(port: number) => Observable<void>>(),
  reply: vi.fn<(address: ProductAddress, reply: { id: string; text: string }) => Observable<unknown>>(),
}));

vi.mock('../../host/design', () => ({
  listedComments$: host.list,
  writeComment$: host.write,
  withdrawComment$: host.done,
  commentChanges$: host.changes,
  replyToComment$: host.reply,
}));

const listed = (id: string, createdAt: string): ListedComment => ({
  id,
  part: 'components/card',
  state: 'empty',
  size: 'phone',
  text: `text ${id}`,
  createdAt,
  replies: [],
  stale: null,
});

const ADDRESS = { port: 4492, product: 'shop' };

const PLACE = { part: 'components/card', state: 'empty', size: 'phone' };

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideCommentStore()] });
  const store = TestBed.runInInjectionContext(() => injectCommentStore());
  const source = signal<CommentSource>({ address: ADDRESS, revision: 0 });

  store.connect(source);
  TestBed.tick();

  return { store, source };
};

describe('CommentStore', () => {
  let changes: Subject<void>;
  let stored: ListedComment[];

  beforeEach(() => {
    changes = new Subject();
    stored = [listed('b', '2026-10-27T10:00:02Z'), listed('a', '2026-10-27T10:00:01Z')];
    host.list.mockReset().mockImplementation(() => of({ comments: [...stored], unreadable: [] }));
    host.write.mockReset().mockReturnValue(of({}));
    host.done.mockReset().mockReturnValue(of(undefined));
    host.changes.mockReset().mockReturnValue(changes);
    host.reply.mockReset().mockImplementation((_, { id, text }) => {
      stored = stored.map((entry) =>
        entry.id === id ? { ...entry, replies: [...entry.replies, { by: 'user', text, createdAt: '' }] } : entry,
      );

      return of({});
    });
  });

  it('numbers the comments oldest first and reloads them on a comment change and a new revision', () => {
    const { store, source } = setup();

    expect(store.comments().map((comment) => [comment.id, comment.number])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(host.changes).toHaveBeenCalledWith(4492);

    stored = [listed('a', '2026-10-27T10:00:01Z')];
    changes.next();
    TestBed.tick();
    expect(store.comments().map((comment) => comment.id)).toEqual(['a']);

    source.set({ address: ADDRESS, revision: 1 });
    TestBed.tick();
    expect(host.list).toHaveBeenCalledTimes(3);
    expect(host.changes).toHaveBeenCalledTimes(1);
  });

  it('sends a draft at its rounded point, keeps the mode on, and reloads', () => {
    const { store } = setup();

    store.toggle();
    store.start({ frameId: 'f', place: PLACE, point: { x: 10.4, y: 20.6 } });
    store.send('  too tight  ');
    TestBed.tick();

    expect(host.write).toHaveBeenCalledWith(ADDRESS, { ...PLACE, point: { x: 10, y: 21 }, text: 'too tight' });
    expect(store.draft()).toBeNull();
    expect(store.active()).toBe(true);
    expect(host.list).toHaveBeenCalledTimes(2);
  });

  it('sends a state comment without a point, and ignores an empty text', () => {
    const { store } = setup();

    store.start({ frameId: 'f', place: PLACE, point: null });
    store.send('   ');
    expect(host.write).not.toHaveBeenCalled();

    store.send('state');
    expect(host.write).toHaveBeenCalledWith(ADDRESS, { ...PLACE, text: 'state' });
  });

  it('keeps the draft and reports a failed write', () => {
    host.write.mockReturnValue(throwError(() => new Error('server down')));
    const { store } = setup();

    store.start({ frameId: 'f', place: PLACE, point: null });
    store.send('x');

    expect(store.draft()).not.toBeNull();
    expect(store.error()).toBe('server down');
    expect(store.busy()).toBe(false);
  });

  it('withdraws a comment through comment-withdraw, and ending the mode drops the draft', () => {
    const { store } = setup();

    store.withdraw('a');
    expect(host.done).toHaveBeenCalledWith(ADDRESS, 'a');

    store.toggle();
    store.start({ frameId: 'f', place: PLACE, point: null });
    store.end();
    expect(store.active()).toBe(false);
    expect(store.draft()).toBeNull();
  });

  it('posts a trimmed reply, reloads the thread, and counts the send; an agent reply makes a question', () => {
    const { store } = setup();

    store.reply('a', '   ');
    expect(host.reply).not.toHaveBeenCalled();

    store.reply('a', ' smaller? ');
    TestBed.tick();

    expect(host.reply).toHaveBeenCalledWith(ADDRESS, { id: 'a', text: 'smaller?' });
    expect(store.comments()[0]?.replies.map((reply) => reply.text)).toEqual(['smaller?']);
    expect(store.repliesSent()).toBe(1);
    expect(store.questions()).toEqual([]);

    stored = stored.map((entry) =>
      entry.id === 'b' ? { ...entry, replies: [{ by: 'agent', text: 'which one?', createdAt: '' }] } : entry,
    );
    changes.next();
    TestBed.tick();
    expect(store.questions().map((entry) => entry.id)).toEqual(['b']);
  });

  it('keeps the reply field and reports a failed reply', () => {
    host.reply.mockReturnValue(throwError(() => new Error('gone')));
    const { store } = setup();

    store.reply('a', 'x');

    expect(store.repliesSent()).toBe(0);
    expect(store.error()).toBe('gone');
  });
});
