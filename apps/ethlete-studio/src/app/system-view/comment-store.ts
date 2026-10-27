import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { EMPTY, Observable, catchError, finalize, of, scan, startWith, switchMap, tap } from 'rxjs';
import {
  ListedComments,
  ProductAddress,
  commentChanges$,
  withdrawComment$,
  listedComments$,
  writeComment$,
} from '../../host/design';
import { rememberView, rememberedView } from '../studio-view/remembered';
import { CommentDraft, commentPlaceOf, numberedCommentsOf } from './comment-pins';

/** What the store reads from: the product on the design server, and a revision that forces a reload. */
export type CommentSource = { address: ProductAddress | null; revision: number };

const NO_COMMENTS: ListedComments = { comments: [], unreadable: [] };

const NO_SOURCE: CommentSource = { address: null, revision: 0 };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sameAddress = (a: ProductAddress | null, b: ProductAddress | null) =>
  a?.port === b?.port && a?.product === b?.product;

/** The open comments of the shown product, the comment mode, the draft and the panel, for the system view and its children. */
export class CommentStore {
  private destroyRef = inject(DestroyRef);

  private source = signal<Signal<CommentSource>>(signal(NO_SOURCE));

  private address = computed(() => this.source()().address, { equal: sameAddress });

  private reloads = signal(0);

  private changes = toSignal(
    toObservable(computed(() => this.address()?.port ?? null)).pipe(
      switchMap((port) =>
        port
          ? commentChanges$(port).pipe(
              scan((count) => count + 1, 0),
              catchError(() => EMPTY),
            )
          : EMPTY,
      ),
      startWith(0),
    ),
    { initialValue: 0 },
  );

  private reading = toSignal(
    toObservable(
      computed(() => ({
        address: this.address(),
        revision: this.source()().revision,
        changes: this.changes(),
        reloads: this.reloads(),
      })),
    ).pipe(
      switchMap(({ address }) =>
        address
          ? listedComments$(address).pipe(catchError((): Observable<ListedComments> => of(NO_COMMENTS)))
          : of(NO_COMMENTS),
      ),
    ),
    { initialValue: NO_COMMENTS },
  );

  /** The open comments of the product, numbered oldest first. */
  public comments = computed(() => numberedCommentsOf(this.reading().comments));

  public active = signal(false);

  public draft = signal<CommentDraft | null>(null);

  public panelOpen = signal(rememberedView().commentsOpen ?? false);

  public busy = signal(false);

  public error = signal('');

  /** Reads the comments of the product `source` names, again whenever its revision changes. */
  public connect(source: Signal<CommentSource>) {
    this.source.set(source);
  }

  public toggle() {
    if (this.active()) this.end();
    else this.active.set(true);
  }

  /** Ends comment mode and drops the draft. */
  public end() {
    this.active.set(false);
    this.cancel();
  }

  /** Shows or hides the comment sidebar, and remembers it for the next start. */
  public showPanel(open: boolean) {
    this.panelOpen.set(open);
    rememberView({ commentsOpen: open });
  }

  public start(draft: CommentDraft) {
    this.draft.set(draft);
    this.error.set('');
  }

  public cancel() {
    this.draft.set(null);
    this.error.set('');
  }

  /** Writes the draft with `text`; comment mode stays on. */
  public send(text: string) {
    const address = this.address();
    const draft = this.draft();
    const trimmed = text.trim();

    if (!address || !draft || !trimmed || this.busy()) return;

    this.run(
      writeComment$(address, { ...commentPlaceOf(draft.place, draft.point), text: trimmed }).pipe(
        tap(() => this.draft.set(null)),
      ),
    );
  }

  /** Deletes a comment through `comment-withdraw`. */
  public withdraw(id: string) {
    const address = this.address();

    if (!address || this.busy()) return;

    this.run(withdrawComment$(address, id));
  }

  private run(work$: Observable<unknown>) {
    this.busy.set(true);
    this.error.set('');
    work$
      .pipe(
        tap(() => this.reloads.update((count) => count + 1)),
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

const COMMENT_STORE_DEF = /* @__PURE__ */ defineProvider(() => new CommentStore());

export const provideCommentStore = /* @__PURE__ */ toProvideFn(COMMENT_STORE_DEF);

export const injectCommentStore = /* @__PURE__ */ toInjectFn(COMMENT_STORE_DEF);
