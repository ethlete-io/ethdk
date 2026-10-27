import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { EMPTY, Observable, catchError, finalize, of, scan, startWith, switchMap, tap } from 'rxjs';
import { ProductAddress } from '../../host/design';
import {
  ListedNotes,
  changeFlowNote$,
  changeNote$,
  deleteFlowNote$,
  deleteNote$,
  listedNotes$,
  noteChanges$,
  writeFlowNote$,
  writeNote$,
} from '../../host/design-notes';
import { CommentSource } from './comment-store';
import { NoteDraft, NoteEdit, roundedPoint } from './note-places';

const NO_NOTES: ListedNotes = { notes: [], unreadable: [] };

const NO_SOURCE: CommentSource = { address: null, revision: 0 };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sameAddress = (a: ProductAddress | null, b: ProductAddress | null) =>
  a?.port === b?.port && a?.product === b?.product;

/** The notes on the states of the shown product, the note mode, the draft and the note being changed. */
export class NoteStore {
  private destroyRef = inject(DestroyRef);

  private source = signal<Signal<CommentSource>>(signal(NO_SOURCE));

  private address = computed(() => this.source()().address, { equal: sameAddress });

  private changes = toSignal(
    toObservable(computed(() => this.address()?.port ?? null)).pipe(
      switchMap((port) =>
        port
          ? noteChanges$(port).pipe(
              scan((count) => count + 1, 0),
              catchError(() => EMPTY),
            )
          : EMPTY,
      ),
      startWith(0),
    ),
    { initialValue: 0 },
  );

  /** Counts the writes that went through, so a reader of flow files can read them again. */
  public writes = signal(0);

  private reading = toSignal(
    toObservable(
      computed(() => ({
        address: this.address(),
        revision: this.source()().revision,
        changes: this.changes(),
        writes: this.writes(),
      })),
    ).pipe(
      switchMap(({ address }) =>
        address ? listedNotes$(address).pipe(catchError((): Observable<ListedNotes> => of(NO_NOTES))) : of(NO_NOTES),
      ),
    ),
    { initialValue: NO_NOTES },
  );

  public notes = computed(() => this.reading().notes);

  public active = signal(false);

  public draft = signal<NoteDraft | null>(null);

  public editing = signal<NoteEdit | null>(null);

  public busy = signal(false);

  public error = signal('');

  /** Reads the notes of the product `source` names, again whenever its revision changes. */
  public connect(source: Signal<CommentSource>) {
    this.source.set(source);
  }

  public toggle() {
    if (this.active()) this.end();
    else this.active.set(true);
  }

  /** Ends note mode and drops the draft. */
  public end() {
    this.active.set(false);
    this.draft.set(null);
    this.error.set('');
  }

  public start(draft: NoteDraft) {
    this.draft.set(draft);
    this.editing.set(null);
    this.error.set('');
  }

  public edit(edit: NoteEdit) {
    this.editing.set(edit);
    this.draft.set(null);
    this.error.set('');
  }

  /** Drops the draft and ends the change of a note. */
  public cancel() {
    this.draft.set(null);
    this.editing.set(null);
    this.error.set('');
  }

  /** Writes the draft with `text`; note mode stays on. */
  public send(text: string) {
    const address = this.address();
    const draft = this.draft();
    const trimmed = text.trim();

    if (!address || !draft || !trimmed || this.busy()) return;

    const write$ =
      'at' in draft
        ? writeFlowNote$({ ...address, flow: draft.flow }, { text: trimmed, at: roundedPoint(draft.at) })
        : writeNote$(address, {
            part: draft.place.part,
            state: draft.place.state,
            text: trimmed,
            ...(draft.point ? { point: roundedPoint(draft.point), size: draft.place.size } : {}),
          });

    this.run(write$.pipe(tap(() => this.draft.set(null))));
  }

  /** Gives the note being changed the text `text`. */
  public save(text: string) {
    const address = this.address();
    const editing = this.editing();
    const trimmed = text.trim();

    if (!address || !editing || !trimmed || this.busy()) return;

    const change = { id: editing.id, text: trimmed };

    this.run(
      (editing.flow === null
        ? changeNote$(address, change)
        : changeFlowNote$({ ...address, flow: editing.flow }, change)
      ).pipe(tap(() => this.editing.set(null))),
    );
  }

  public remove() {
    const address = this.address();
    const editing = this.editing();

    if (!address || !editing || this.busy()) return;

    this.run(
      (editing.flow === null
        ? deleteNote$(address, editing.id)
        : deleteFlowNote$({ ...address, flow: editing.flow }, editing.id)
      ).pipe(tap(() => this.editing.set(null))),
    );
  }

  private run(work$: Observable<unknown>) {
    this.busy.set(true);
    this.error.set('');
    work$
      .pipe(
        tap(() => this.writes.update((count) => count + 1)),
        catchError((error: unknown) => {
          this.error.set(messageOf(error));

          return EMPTY;
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

const NOTE_STORE_DEF = /* @__PURE__ */ defineProvider(() => new NoteStore());

export const provideNoteStore = /* @__PURE__ */ toProvideFn(NOTE_STORE_DEF);

export const injectNoteStore = /* @__PURE__ */ toInjectFn(NOTE_STORE_DEF);
