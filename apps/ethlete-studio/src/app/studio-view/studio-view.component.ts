import { Component, DOCUMENT, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subscription,
  buffer,
  catchError,
  debounceTime,
  filter,
  finalize,
  first,
  interval,
  map,
  of,
  retry,
  share,
  startWith,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import {
  Project,
  ServerState,
  designProject$,
  designServerRestart$,
  designServerStart$,
  designServerState$,
  designServerStop$,
} from '../../host/design';
import { DesignChange, designChanges$ } from '../../host/design-changes';
import { PartsRedraw } from '../../host/design-parts';
import { SystemViewComponent } from '../system-view/system-view.component';
import { ShellAction, ShellPageComponent } from '../design-parts/shell-main/shell-page.component';
import { DesignServerAction } from '../design-parts/studio-menu/studio-menu.component';
import { injectUpdateCheck } from '../update-check';
import { createCheckouts, folderNameOf } from './checkouts';
import { NO_FRAME_REVISIONS, frameReports$, frameRevisionsWith, frameRevisionsWithReport } from './frame-revisions';
import { NO_LIST_REVISIONS, listRevisionsWith } from './list-revisions';
import { rememberView, rememberedView } from './remembered';

/** One edit lands as several file events, and an agent writes a whole round in a burst. */
const SETTLE_MS = 300;

const FOREIGN_SERVER_POLL_MS = 3000;

const SERVER_ANSWER_RETRY_MS = 1000;

@Component({
  selector: 'ethlete-studio-view',
  template: `
    @if (serverDown() || serverStarting()) {
      <ethlete-shell-page
        [shell]="{
          product: '',
          products: [],
          project: projectName(),
          projects: checkouts.names(),
          panel: serverPanel(),
          server: serverDown() ? 'stopped' : 'starting',
          serverLog: downLog(),
        }"
        (action)="runShellAction($event)"
      />
    } @else {
      <ethlete-system-view
        [port]="server()?.listening ? (design()?.port ?? null) : null"
        [epoch]="epoch()"
        [checkout]="checkout()"
        [projectThemes]="design()?.themes ?? {}"
        [lists]="lists()"
        [frameRevisions]="frameRevisions()"
        [project]="projectName()"
        [projects]="checkouts.names()"
        (projectChange)="checkouts.chooseByName($event)"
        (openProject)="checkouts.openFolder()"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellPageComponent, SystemViewComponent],
  host: {
    class: 'grid h-dvh grid-rows-[minmax(0,1fr)] bg-(--et-surface-background-solid) text-text',
  },
})
export class StudioViewComponent {
  private destroyRef = inject(DestroyRef);

  public checkout = signal('');
  protected projectName = computed(() => folderNameOf(this.checkout()));
  protected serverPanel = signal<'open' | 'hidden'>('open');
  protected design = signal<Project | null>(null);
  protected server = signal<ServerState | null>(null);
  public serverBusy = signal(false);
  protected epoch = signal(0);
  protected lists = signal(NO_LIST_REVISIONS);
  public frameRevisions = signal(NO_FRAME_REVISIONS);

  private foreignWatch: Subscription | null = null;

  protected checkouts = createCheckouts({
    remembered: rememberedView().checkout ?? '',
    pick: (checkout) => this.setCheckout(checkout),
  });

  private listeningPort = computed(() => {
    const state = this.server();

    return state?.listening ? state.port : null;
  });

  private serverAnswered = toSignal(
    toObservable(this.listeningPort).pipe(switchMap((port) => (port === null ? of(false) : serverAnswers$(port)))),
    { initialValue: false },
  );

  public serverReady = computed(() => this.listeningPort() !== null && this.serverAnswered());

  protected serverDown = computed(() => {
    const state = this.server();

    return state && !state.listening && !this.serverBusy() ? state : null;
  });

  protected serverStarting = computed(
    () => !!this.server() && (this.server()?.listening ? !this.serverReady() : this.serverBusy()),
  );

  protected downLog = computed(() => (this.serverDown()?.log ?? []).slice(-10));

  constructor() {
    injectUpdateCheck();

    toObservable(this.listeningPort)
      .pipe(
        switchMap((port) => {
          if (port === null) return EMPTY;

          const changes$ = designChanges$(port).pipe(
            catchError(() => EMPTY),
            share(),
          );

          return changes$.pipe(buffer(changes$.pipe(debounceTime(SETTLE_MS))));
        }),
        tap((changes) => this.absorbChanges(changes)),
        filter((changes) => changes.some((change) => change.kind === 'all')),
        switchMap(() => {
          const checkout = this.checkout();

          return checkout
            ? designProject$(checkout).pipe(
                filter(() => checkout === this.checkout()),
                catchError(() => EMPTY),
              )
            : EMPTY;
        }),
        tap((project) => this.absorb(project)),
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
    if (action.kind === 'server') this.runServerAction(action.action);
  }

  public startServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.serverBusy.set(true);

    designServerStart$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        catchError(() => of(null)),
        finalize(() => this.serverBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public restartServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.serverBusy.set(true);

    designServerRestart$(checkout)
      .pipe(
        tap((state) => {
          this.showServer(state);
          this.epoch.update((value) => value + 1);
        }),
        catchError(() => of(null)),
        finalize(() => this.serverBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public stopServer() {
    const checkout = this.checkout();

    if (!checkout) return;

    designServerStop$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private setCheckout(path: string) {
    this.checkout.set(path);
    this.design.set(null);
    this.foreignWatch?.unsubscribe();
    this.foreignWatch = null;
    rememberView({ checkout: path });
    this.read();
    this.readServer();
  }

  private runServerAction(action: DesignServerAction) {
    if (action === 'start') this.startServer();
    if (action === 'restart') this.restartServer();
    if (action === 'stop') this.stopServer();
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

    designProject$(checkout)
      .pipe(
        tap((project) => {
          if (checkout === this.checkout()) this.design.set(project);
        }),
        catchError(() => of(null)),
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

const serverAnswers$ = (port: number) =>
  fromFetch(`http://localhost:${port}/__design/system`).pipe(
    map((response) => {
      if (response.status >= 500) throw new Error(`${response.status}`);

      return true;
    }),
    retry({ delay: () => timer(SERVER_ANSWER_RETRY_MS) }),
    startWith(false),
  );
