import { Component, DOCUMENT, DestroyRef, ViewEncapsulation, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  buffer,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  first,
  interval,
  map,
  merge,
  from,
  of,
  repeat,
  retry,
  share,
  startWith,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
  timeout,
  timer,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import {
  Project,
  ServerState,
  designProject$,
  designServerRebuild$,
  designServerRestart$,
  designServerStart$,
  designServerState$,
  designServerStop$,
} from '../../host/design';
import { DESIGN_SERVER_LABELS } from '../i18n/shell-labels';
import { DesignChange, designChanges$ } from '../../host/design-changes';
import { DESIGN_STAMP_PATH, designServerReplaced$ } from '../../host/design-server-pid';
import { PartsRedraw } from '../../host/design-parts';
import { SystemViewComponent } from '../system-view/system-view.component';
import { ShellAction, ShellPageComponent } from '../design-parts/shell-main/shell-page.component';
import { DesignServerAction } from '../design-parts/studio-menu/studio-menu.component';
import { injectUpdateCheck } from '../update-check';
import { injectCodeWatch } from '../code-watch';
import { createCheckouts, folderNameOf } from './checkouts';
import { NO_FRAME_REVISIONS, frameReports$, frameRevisionsWith, frameRevisionsWithReport } from './frame-revisions';
import { NO_LIST_REVISIONS, listRevisionsWith } from './list-revisions';
import { rememberView, rememberedView } from './remembered';
import { serverCrashOf } from './server-crash';
import { serverIdle$ } from './server-idle';

/** One edit lands as several file events, and an agent writes a whole round in a burst. */
const SETTLE_MS = 300;

const FOREIGN_SERVER_POLL_MS = 3000;

const SERVER_ANSWER_RETRY_MS = 1000;

const SERVER_ANSWER_TIMEOUT_MS = 5000;

const SERVER_SILENT_MS = 30_000;

const OTHER_ROOT_POLL_MS = 1000;

const START_PHASE_POLL_MS = 1000;

const START_CLOCK_MS = 1000;

const SERVER_IDLE_POLL_MS = 5000;

export type StartPhaseReading = { phase: NonNullable<ServerState['phase']>; phaseMs: number };

type StartPhaseSince = { phase: StartPhaseReading['phase']; since: number; readAt: number };

const messageLinesOf = (error: unknown) =>
  (error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)).split('\n');

type ShownProducts = {
  checkout: string | null;
  product: string;
  products: string[];
  logos: Record<string, string | null | undefined>;
};

const NO_PRODUCTS: ShownProducts = { checkout: null, product: '', products: [], logos: {} };

@Component({
  selector: 'ethlete-studio-view',
  template: `
    @if (serverDown() || serverStarting()) {
      <ethlete-shell-page
        [shell]="{
          product: shownProducts().product || projectName(),
          products: shownProducts().products,
          logos: shownProducts().logos,
          project: checkout(),
          projects: checkouts.roots(),
          panel: serverPanel(),
          server: serverDown() ? (serverCrash() ? 'crashed' : 'stopped') : serverSilent() ? 'unanswered' : 'starting',
          serverUrl: serverUrl(),
          serverLog: downLog(),
          startPhase: startPhase(),
          serverCrash: serverCrash(),
          serverStale: serverStale(),
          serverCliOutdated: serverCliOutdated(),
          busy: menuBusy(),
        }"
        (action)="runShellAction($event)"
      >
        <p class="m-0 px-space-3 py-space-2 text-ui-sm text-et-surface-text-muted" shellMainSide>
          {{ LABELS.sideWaiting }}
        </p>
      </ethlete-shell-page>
    } @else {
      <ethlete-system-view
        #systemView
        [port]="server()?.listening ? (design()?.port ?? null) : null"
        [epoch]="epoch()"
        [checkout]="checkout()"
        [projectThemes]="design()?.themes ?? {}"
        [lists]="lists()"
        [frameRevisions]="frameRevisions()"
        [project]="projectName()"
        [projects]="checkouts.names()"
        [roots]="checkouts.roots()"
        [busy]="menuBusy()"
        [serverStale]="serverStale()"
        [serverCliOutdated]="serverCliOutdated()"
        (projectChange)="checkouts.chooseByName($event)"
        (openProject)="checkouts.openFolder()"
        (scanProjects)="checkouts.scan()"
        (removeProject)="checkouts.forget()"
        (reload)="reload()"
        (menuOpen)="refreshServer()"
        (serverAction)="runServerAction($event)"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellPageComponent, SystemViewComponent],
  host: {
    class: 'grid min-h-0 grow grid-rows-[minmax(0,1fr)] bg-(--et-surface-background) text-text',
  },
})
export class StudioViewComponent {
  private destroyRef = inject(DestroyRef);

  private codeWatch = injectCodeWatch();
  private systemView = viewChild<SystemViewComponent>('systemView');

  protected readonly LABELS = DESIGN_SERVER_LABELS;
  public checkout = signal('');
  protected projectName = computed(() => folderNameOf(this.checkout()));
  protected serverPanel = signal<'open' | 'hidden'>('open');
  protected design = signal<Project | null>(null);
  protected server = signal<ServerState | null>(null);
  public serverBusy = signal(false);
  protected epoch = signal(0);
  protected lists = signal(NO_LIST_REVISIONS);

  public frameRevisions = signal(NO_FRAME_REVISIONS);

  private lastProducts = toSignal(
    toObservable(
      computed((): ShownProducts | null => {
        const view = this.systemView();

        return view
          ? {
              checkout: view.productsCheckout(),
              product: view.productName(),
              products: view.productNames(),
              logos: view.productLogos(),
            }
          : null;
      }),
    ).pipe(filter((shown): shown is ShownProducts => !!shown && shown.products.length > 0)),
    { initialValue: NO_PRODUCTS },
  );

  protected shownProducts = computed(() => {
    const shown = this.lastProducts();

    return shown.checkout === this.checkout() ? shown : NO_PRODUCTS;
  });

  public startError = signal<string[] | null>(null);

  private foreignWatch: Subscription | null = null;

  protected checkouts = createCheckouts({
    remembered: rememberedView().checkout ?? '',
    pick: (checkout) => this.setCheckout(checkout),
  });

  private serverStopping = signal(false);
  private projectReads = signal(0);
  protected menuBusy = computed(
    () => this.serverBusy() || this.serverStopping() || this.projectReads() > 0 || this.checkouts.adding(),
  );

  private listeningPort = computed(() => {
    const state = this.server();

    return state?.listening ? state.port : null;
  });

  private handOver = signal<{ checkout: string; port: number } | null>(null);

  private answerTarget = computed(
    () => {
      const port = this.listeningPort();

      return port === null ? null : { port, checkout: this.checkout() };
    },
    { equal: (a, b) => a?.port === b?.port && a?.checkout === b?.checkout },
  );

  private serverAnswer = toSignal(
    toObservable(this.answerTarget).pipe(
      switchMap((target) =>
        target === null ? of<ServerAnswer>('waiting') : serverAnswers$(target.port, target.checkout),
      ),
    ),
    { initialValue: 'waiting' as ServerAnswer },
  );

  private servedOtherRoot = computed(() => {
    const answer = this.serverAnswer();

    return typeof answer === 'object' ? answer.otherRoot : null;
  });

  public serverReady = computed(() => this.listeningPort() !== null && this.serverAnswer() === 'answers');

  protected serverStale = computed(() => !!this.server()?.listening && !!this.server()?.stale && !this.serverBusy());

  protected serverCliOutdated = computed(() => this.server()?.staleReason === 'cli-build-outdated');

  protected serverSilent = computed(() => this.listeningPort() !== null && this.serverAnswer() === 'silent');

  protected serverUrl = computed(() => {
    const port = this.listeningPort();

    return port === null ? '' : serverUrlOf(port);
  });

  protected serverDown = computed(() => {
    const state = this.server();

    if (!state || this.serverBusy()) return null;

    const otherProject = this.servedOtherRoot() !== null && !this.handOver() && !this.serverStopping();

    return !state.listening || otherProject ? state : null;
  });

  protected serverStarting = computed(
    () => !!this.server() && (this.server()?.listening ? !this.serverReady() : this.serverBusy()),
  );

  private startReading = toSignal(
    toObservable(this.serverBusy).pipe(
      switchMap((busy) =>
        busy
          ? interval(START_PHASE_POLL_MS).pipe(
              exhaustMap(() =>
                designServerState$(this.checkout(), this.server()).pipe(
                  // eslint-disable-next-line ethlete/no-silent-catch-error -- a missed poll keeps the last phase until the next one
                  catchError(() => EMPTY),
                ),
              ),
              map((state): StartPhaseSince | null => {
                const readAt = Date.now();

                return state.listening || !state.phase
                  ? null
                  : { phase: state.phase, since: readAt - state.phaseMs, readAt };
              }),
            )
          : of(null),
      ),
    ),
    { initialValue: null as StartPhaseSince | null },
  );

  private startClock = toSignal(
    toObservable(this.serverStarting).pipe(
      switchMap((starting) =>
        starting
          ? defer(() => {
              const shownAt = Date.now();

              return interval(START_CLOCK_MS).pipe(
                startWith(0),
                map(() => ({ shownAt, now: Date.now() })),
              );
            })
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  public startPhase = computed((): StartPhaseReading | null => {
    const clock = this.startClock();

    if (!clock) return null;

    const reading = this.startReading();
    const now = Math.max(clock.now, reading?.readAt ?? 0);

    return { phase: reading?.phase ?? 'starting', phaseMs: Math.max(0, now - (reading?.since ?? clock.shownAt)) };
  });

  protected serverCrash = computed(() => serverCrashOf(this.serverDown()?.crash ?? null));

  protected downLog = computed(() => {
    const otherRoot = this.servedOtherRoot();
    const taken = otherRoot === null ? null : [`Port ${this.listeningPort()} serves another project: ${otherRoot}`];

    return (this.startError() ?? taken ?? this.serverDown()?.log ?? []).slice(-10);
  });

  constructor() {
    injectUpdateCheck();

    toObservable(this.listeningPort)
      .pipe(
        switchMap((port) => {
          if (port === null) return EMPTY;

          const changes$ = designChanges$(port).pipe(
            // eslint-disable-next-line ethlete/no-silent-catch-error -- the change feed is a best effort refresh trigger
            catchError(() => EMPTY),
            share(),
          );

          return changes$.pipe(buffer(changes$.pipe(debounceTime(SETTLE_MS))));
        }),
        tap((changes) => this.absorbChanges(changes)),
        filter((changes) => changes.some((change) => change.kind === 'all' || change.kind === 'relisted')),
        switchMap(() => {
          const checkout = this.checkout();

          return checkout
            ? designProject$(checkout).pipe(
                filter(() => checkout === this.checkout()),
                // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed project read keeps the last shown project
                catchError(() => EMPTY),
              )
            : EMPTY;
        }),
        tap((project) => this.absorb(project)),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.listeningPort)
      .pipe(
        switchMap((port) => (port === null ? EMPTY : designServerReplaced$(port))),
        tap(() => this.epoch.update((value) => value + 1)),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.servedOtherRoot)
      .pipe(
        filter((root): root is string => root !== null),
        tap((root) => this.handOverPort(root)),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.codeWatch.serverRenewal)
      .pipe(
        distinctUntilChanged(),
        switchMap((renewal) =>
          renewal === null
            ? EMPTY
            : timer(0, SERVER_IDLE_POLL_MS).pipe(
                exhaustMap(() => {
                  const port = this.listeningPort();

                  return port === null ? of(false) : serverIdle$(port);
                }),
                first(Boolean),
              ),
        ),
        filter(() => this.codeWatch.restart() === null && !this.serverBusy()),
        tap(() => this.codeWatch.act('restartServer')),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.codeWatch.serverRestarts$
      .pipe(
        tap(() => this.restartServer()),
        takeUntilDestroyed(),
      )
      .subscribe();

    frameReports$(inject(DOCUMENT))
      .pipe(
        tap((report) => this.frameRevisions.update((revisions) => frameRevisionsWithReport(revisions, report))),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected runShellAction(action: ShellAction) {
    if (action.kind === 'collapse') this.serverPanel.set('hidden');
    if (action.kind === 'section') this.serverPanel.set('open');
    if (action.kind === 'project') this.checkouts.chooseByName(action.name);
    if (action.kind === 'openProject') this.checkouts.openFolder();
    if (action.kind === 'scan') this.checkouts.scan();
    if (action.kind === 'remove-project') this.checkouts.forget();
    if (action.kind === 'reload') this.reload();
    if (action.kind === 'menuOpened') this.refreshServer();
    if (action.kind === 'server') this.runServerAction(action.action);
  }

  public startServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.startError.set(null);
    this.serverBusy.set(true);

    designServerStart$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        catchError((error) => {
          this.startError.set(messageLinesOf(error));

          return of(null);
        }),
        finalize(() => this.serverBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public restartServer(restart$: (checkout: string) => Observable<ServerState> = designServerRestart$) {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.startError.set(null);
    this.serverBusy.set(true);

    restart$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- failRestart shows the restart toast
        catchError(() => {
          this.codeWatch.failRestart();

          return of(null);
        }),
        finalize(() => {
          this.serverBusy.set(false);
          this.codeWatch.settleRestart();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected reload() {
    this.epoch.update((value) => value + 1);
    this.read();
    this.readServer();
  }

  public stopServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverStopping()) return;

    this.serverStopping.set(true);

    designServerStop$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- not surfaced yet, finding 145
        catchError(() => of(null)),
        finalize(() => this.serverStopping.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected runServerAction(action: DesignServerAction) {
    if (action === 'start') this.startServer();
    if (action === 'restart') this.restartServer();
    if (action === 'rebuild') this.restartServer(designServerRebuild$);
    if (action === 'stop') this.stopServer();
  }

  protected refreshServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    designServerState$(checkout, this.server())
      .pipe(
        tap((state) => this.showServer(state)),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the server state is re-read on the next menu open; the foreign watch polls
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private setCheckout(path: string) {
    const before = this.server();

    this.handOver.set(
      before?.listening && before.managed && this.checkout() ? { checkout: this.checkout(), port: before.port } : null,
    );
    this.checkout.set(path);
    this.design.set(null);
    this.foreignWatch?.unsubscribe();
    this.foreignWatch = null;
    rememberView({ checkout: path });
    this.read();
    this.readServer();
  }

  private handOverPort(otherRoot: string) {
    const handOver = this.handOver();
    const checkout = this.checkout();

    if (!handOver || handOver.port !== this.listeningPort() || !sameRoot(handOver.checkout, otherRoot)) return;

    this.serverStopping.set(true);

    designServerState$(checkout)
      .pipe(
        switchMap((state) =>
          state.port === handOver.port
            ? designServerStop$(handOver.checkout).pipe(switchMap(() => designServerState$(checkout)))
            : of(state),
        ),
        tap((state) => {
          if (checkout !== this.checkout()) return;

          this.showServer(state);

          if (!state.listening) this.startServer();
        }),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the stopped page shows the other project and offers a restart
        catchError(() => of(null)),
        finalize(() => {
          this.handOver.set(null);
          this.serverStopping.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private absorbChanges(changes: DesignChange[]) {
    const redraws = changes.flatMap((change): PartsRedraw[] =>
      change.kind === 'parts' ? [change.change] : change.kind === 'all' ? [{ all: true }] : [],
    );

    this.frameRevisions.update((revisions) => redraws.reduce(frameRevisionsWith, revisions));
    this.lists.update((revisions) => listRevisionsWith(revisions, changes));
  }

  private read() {
    const checkout = this.checkout();

    if (!checkout) return;

    this.projectReads.update((reads) => reads + 1);

    designProject$(checkout)
      .pipe(
        tap((project) => {
          if (checkout === this.checkout()) this.design.set(project);
        }),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed project read keeps the last shown project
        catchError(() => of(null)),
        finalize(() => this.projectReads.update((reads) => reads - 1)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private absorb(project: Project) {
    if (JSON.stringify(project) === JSON.stringify(this.design())) return;

    this.design.set(project);
  }

  private readServer() {
    const checkout = this.checkout();

    if (!checkout) return;

    designServerState$(checkout)
      .pipe(
        tap((state) => {
          this.showServer(state);

          if (!state.listening) this.startServer();
        }),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the server state is re-read on the next trigger; the foreign watch polls
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private showServer(state: ServerState) {
    const answered = this.server()?.listening ?? false;

    this.server.set(state);

    if (state.listening && !answered) this.epoch.update((value) => value + 1);
    if (state.listening && state.foreign) this.watchForeignServer();
  }

  private watchForeignServer() {
    const checkout = this.checkout();

    if (!checkout || (this.foreignWatch && !this.foreignWatch.closed)) return;

    this.foreignWatch = interval(FOREIGN_SERVER_POLL_MS)
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- the foreign server watch polls and retries
        switchMap(() => designServerState$(checkout, this.server()).pipe(catchError(() => EMPTY))),
        first((state) => !state.listening || !state.foreign),
        tap((state) => {
          if (this.serverBusy()) return;

          this.showServer(state);

          if (!state.listening) this.startServer();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

type ServerAnswer = 'waiting' | 'answers' | 'silent' | { otherRoot: string };

const serverUrlOf = (port: number) => `http://localhost:${port}`;

const sameRoot = (a: string, b: string) => a.replace(/[\\/]+$/, '') === b.replace(/[\\/]+$/, '');

const answerOf = (stamp: unknown, checkout: string): ServerAnswer => {
  const { projectRoot: root, rootMatches } = (stamp ?? {}) as { projectRoot?: unknown; rootMatches?: unknown };
  const matches = typeof rootMatches === 'boolean' ? rootMatches : typeof root === 'string' && sameRoot(root, checkout);

  return typeof root === 'string' && !matches ? { otherRoot: root } : 'answers';
};

const serverAnswers$ = (port: number, checkout: string) => {
  const answers$ = fromFetch(`${serverUrlOf(port)}${DESIGN_STAMP_PATH}?root=${encodeURIComponent(checkout)}`).pipe(
    switchMap((response) => {
      if (response.status >= 500) throw new Error(`${response.status}`);

      return from(response.json().catch(() => null));
    }),
    map((stamp) => answerOf(stamp, checkout)),
    timeout(SERVER_ANSWER_TIMEOUT_MS),
    retry({ delay: () => timer(SERVER_ANSWER_RETRY_MS) }),
    repeat({ delay: () => timer(OTHER_ROOT_POLL_MS) }),
    takeWhile((answer) => answer !== 'answers', true),
    share(),
  );

  return merge(
    answers$,
    timer(SERVER_SILENT_MS).pipe(
      map((): ServerAnswer => 'silent'),
      takeUntil(answers$),
    ),
  ).pipe(startWith<ServerAnswer>('waiting'));
};
