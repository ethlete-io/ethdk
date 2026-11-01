import { Signal, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { EMPTY, Observable, catchError, filter, map, of, retry, scan, startWith, switchMap, tap, timer } from 'rxjs';
import { ListedComments, ProductAddress, commentChanges$, listedComments$ } from '../../host/design';
import { rememberView, rememberedView } from '../studio-view/remembered';
import { numberedCommentsOf, resolvedCommentsOf } from './comment-pins';

/** What the store reads from: the product on the design server, and a revision that forces a reload. */
export type CommentSource = { address: ProductAddress | null; revision: number };

const NO_COMMENTS: ListedComments = { comments: [], unreadable: [] };

type Read = { address: ProductAddress | null; list: ListedComments | null; error: string };

const INITIAL_READ: Read = { address: null, list: NO_COMMENTS, error: '' };

const RECONNECT_DELAY = 5000;

const NO_SOURCE: CommentSource = { address: null, revision: 0 };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sameAddress = (a: ProductAddress | null, b: ProductAddress | null) =>
  a?.port === b?.port && a?.product === b?.product;

/** The open comments of the shown product, the resolved threads and the panel, for the system view and its children. */
export class CommentStore {
  private source = signal<Signal<CommentSource>>(signal(NO_SOURCE));

  private address = computed(() => this.source()().address, { equal: sameAddress });

  private reloads = signal(0);

  private reconnects = signal(0);

  private live = signal(true);

  private changes = toSignal(
    toObservable(computed(() => ({ port: this.address()?.port ?? null, reconnects: this.reconnects() }))).pipe(
      switchMap(({ port }) => {
        this.live.set(true);

        return port
          ? commentChanges$(port).pipe(
              retry({
                delay: () => {
                  this.live.set(false);

                  return timer(RECONNECT_DELAY);
                },
              }),
              map((event) => event === 'changed' || !this.live()),
              tap(() => this.live.set(true)),
              filter(Boolean),
              scan((count) => count + 1, 0),
            )
          : EMPTY;
      }),
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
      switchMap(({ address }): Observable<Read> => {
        if (!address) return of({ address, list: NO_COMMENTS, error: '' });

        return listedComments$(address).pipe(
          map((list): Read => ({ address, list, error: '' })),
          catchError((error: unknown) => of<Read>({ address, list: null, error: messageOf(error) })),
          startWith<Read>({ address, list: null, error: '' }),
        );
      }),
      scan(
        (previous, next): Read =>
          next.list || !sameAddress(previous.address, next.address)
            ? next
            : { address: next.address, list: previous.list, error: next.error },
        INITIAL_READ,
      ),
    ),
    { initialValue: INITIAL_READ },
  );

  private listed = computed(() => this.reading().list ?? NO_COMMENTS);

  /** Whether the list of the product loaded at least once; an empty inbox is only real after that. */
  public loaded = computed(() => this.reading().list !== null);

  /** The reason the latest list request failed, empty after a successful one. The last good list stays shown. */
  public loadError = computed(() => this.reading().error);

  /** Whether the live update connection dropped, so the list may be behind until `retry`. */
  public interrupted = computed(() => !this.live());

  /** The open comments of the product, numbered oldest first. */
  public comments = computed(() => numberedCommentsOf(this.listed().comments.filter((comment) => !comment.resolved)));

  /** The resolved threads of the product, the latest resolved first. */
  public resolved = computed(() => resolvedCommentsOf(this.listed().comments));

  /** Whether the comment sidebar lists the resolved threads too. */
  public resolvedShown = signal(rememberedView().resolvedShown ?? false);

  public panelOpen = signal(rememberedView().commentsOpen ?? false);

  /** Reads the comments of the product `source` names, again whenever its revision changes. */
  public connect(source: Signal<CommentSource>) {
    this.source.set(source);
  }

  /** Loads the list again and reconnects the live updates. */
  public retry() {
    this.reloads.update((count) => count + 1);
    this.reconnects.update((count) => count + 1);
  }

  /** Shows or hides the comment sidebar, and remembers it for the next start. */
  public showPanel(open: boolean) {
    this.panelOpen.set(open);
    rememberView({ commentsOpen: open });
  }

  /** Shows or hides the resolved threads in the sidebar, and remembers it for the next start. */
  public showResolved(shown: boolean) {
    this.resolvedShown.set(shown);
    rememberView({ resolvedShown: shown });
  }
}

const COMMENT_STORE_DEF = /* @__PURE__ */ defineProvider(() => new CommentStore());

export const provideCommentStore = /* @__PURE__ */ toProvideFn(COMMENT_STORE_DEF);

export const injectCommentStore = /* @__PURE__ */ toInjectFn(COMMENT_STORE_DEF);
