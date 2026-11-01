import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProductAddress } from '../../host/design';
import { ListedNote, ListedNotes } from '../../host/design-notes';
import { CommentSource } from './comment-store';
import { injectNoteStore, provideNoteStore } from './note-store';

const host = vi.hoisted(() => ({
  list: vi.fn<(address: ProductAddress) => Observable<ListedNotes>>(),
  changes: vi.fn<(port: number) => Observable<void>>(),
  write: vi.fn<(address: ProductAddress, note: object) => Observable<void>>(),
  change: vi.fn<(address: ProductAddress, change: object) => Observable<void>>(),
  remove: vi.fn<(address: ProductAddress, id: string) => Observable<void>>(),
}));

vi.mock('../../host/design-notes', () => ({
  listedNotes$: host.list,
  noteChanges$: host.changes,
  writeNote$: host.write,
  changeNote$: host.change,
  deleteNote$: host.remove,
}));

const ADDRESS = { port: 4500, product: 'shop' };

const PLACE = { part: 'pages/library', state: 'empty', size: 'phone' };

const listed = (id: string): ListedNote => ({
  id,
  part: 'pages/library',
  state: 'empty',
  text: `text ${id}`,
  file: `notes/${id}.json`,
  stale: null,
});

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideNoteStore()] });
  const store = TestBed.runInInjectionContext(() => injectNoteStore());
  const source = signal<CommentSource>({ address: ADDRESS, revision: 0 });

  store.connect(source);
  TestBed.tick();

  return { store, source };
};

describe('NoteStore', () => {
  let changes: Subject<void>;
  let stored: ListedNote[];

  beforeEach(() => {
    changes = new Subject();
    stored = [listed('a')];
    host.list.mockReset().mockImplementation(() => of({ notes: [...stored], unreadable: [] }));
    host.changes.mockReset().mockReturnValue(changes);
    for (const write of [host.write, host.change, host.remove]) write.mockReset().mockReturnValue(of(undefined));
  });

  it('reads the notes again on a note change', () => {
    const { store } = setup();

    expect(store.notes().map((note) => note.id)).toEqual(['a']);
    expect(host.changes).toHaveBeenCalledWith(4500);

    stored = [listed('a'), listed('b')];
    changes.next();
    TestBed.tick();

    expect(store.notes().map((note) => note.id)).toEqual(['a', 'b']);
  });

  it('writes a note on a state at its rounded point and the size it was written at, and keeps note mode on', () => {
    const { store } = setup();

    store.toggle();
    store.start({ frameId: 'f', place: PLACE, point: { x: 10.4, y: 20.6 } });
    store.send('  Hero  ');
    TestBed.tick();

    expect(host.write).toHaveBeenCalledWith(ADDRESS, {
      part: 'pages/library',
      state: 'empty',
      text: 'Hero',
      point: { x: 10, y: 21 },
      size: PLACE.size,
    });
    expect(store.writes()).toBe(1);
    expect(store.draft()).toBeNull();
    expect(store.active()).toBe(true);
  });

  it('writes a note on the whole state without a point', () => {
    const { store } = setup();

    store.start({ frameId: 'f', place: PLACE, point: null });
    store.send('Whole');

    expect(host.write).toHaveBeenCalledWith(ADDRESS, { part: 'pages/library', state: 'empty', text: 'Whole' });
  });

  it('changes and deletes a state note', () => {
    const { store } = setup();

    store.edit({ id: 'a', key: 'a f' });
    store.save('New');
    expect(host.change).toHaveBeenCalledWith(ADDRESS, { id: 'a', text: 'New' });
    expect(store.editing()).toBeNull();

    store.edit({ id: 'a', key: 'a f' });
    store.remove();
    expect(host.remove).toHaveBeenCalledWith(ADDRESS, 'a');
    expect(store.writes()).toBe(2);
  });

  it('keeps the note open with the server message when a write fails', () => {
    const { store } = setup();

    host.change.mockReturnValue(throwError(() => new Error('no note x')));
    store.edit({ id: 'x', key: 'x f' });
    store.save('New');

    expect(store.error()).toBe('no note x');
    expect(store.editing()?.id).toBe('x');
    expect(store.writes()).toBe(0);
    expect(store.busy()).toBe(false);
  });

  it('drops the draft when a note is opened for a change, and the change when a draft starts', () => {
    const { store } = setup();

    store.start({ frameId: 'f', place: PLACE, point: null });
    store.edit({ id: 'a', key: 'a f' });
    expect(store.draft()).toBeNull();

    store.start({ frameId: 'f', place: PLACE, point: null });
    expect(store.editing()).toBeNull();
  });
});
