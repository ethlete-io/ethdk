import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
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
import { designQueue$ } from '../../host/design-queue';
import { injectFrameRenderQueue } from '../components/design-canvas/frame-render-queue';
import { SystemViewComponent } from '../system-view/system-view.component';
import { UpdateButtonComponent } from '../update-button.component';
import { UpdateCheckButtonComponent } from '../update-check-button.component';
import { ShellAction, ShellPageComponent } from '../design-parts/shell-main/shell-page.component';
import { CheckoutsComponent, folderNameOf } from './checkouts.component';
import { NO_FRAME_REVISIONS, frameReports$, frameRevisionsWith, frameRevisionsWithReport } from './frame-revisions';
import { NO_LIST_REVISIONS, listRevisionsWith } from './list-revisions';
import { failuresOf, queueLineOf } from './queue-status';
import { rememberView, rememberedView } from './remembered';

/** One edit lands as several file events, and an agent writes a whole round in a burst. */
const SETTLE_MS = 300;

const FOREIGN_SERVER_POLL_MS = 3000;

const SERVER_ANSWER_RETRY_MS = 1000;

const STATUS_ITEM =
  'flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-[1.1rem] tracking-[0.02em] text-(--et-surface-color-subtle-solid)';

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
        }"
        (action)="runShellAction($event, checkouts)"
      >
        <div class="size-full overflow-auto pl-(--st-shell-inset-left)">
          <ng-container [ngTemplateOutlet]="serverMessage" />
        </div>
      </ethlete-shell-page>
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
        (openProject)="checkouts.toggle()"
      />
    }

    <ng-template #serverMessage>
      @if (serverDown(); as down) {
        <div
          class="mx-auto mt-15 flex w-full max-w-6xl flex-col items-start gap-2.5 px-5 text-[1.2rem] text-text-muted"
          role="alert"
        >
          <h3 class="m-0 text-[1.4rem] text-text">The design server stopped</h3>
          @if (watcherHint()) {
            <p class="m-0">The system ran out of file watchers (inotify). Raise fs.inotify.max_user_instances.</p>
          }
          @if (down.log.length) {
            <pre
              class="m-0 box-border max-h-60 w-full overflow-auto rounded-sm bg-[color-mix(in_srgb,var(--et-surface-interaction-solid)_6%,transparent)] p-2.5 font-mono text-[1.1rem] whitespace-pre-wrap"
              >{{ downLog() }}</pre>
          }
          <button (click)="restartServer()" et-button type="button" variant="outline" color="surface" size="sm">
            Restart
          </button>
        </div>
      } @else if (serverStarting()) {
        <div class="mx-auto mt-15 w-full max-w-6xl px-5">
          <h3 class="m-0 text-[1.4rem]">The design server is starting</h3>
        </div>
      }
    </ng-template>

    <footer
      class="flex h-8 items-center gap-4 border-t border-(--et-surface-border-solid) bg-[color-mix(in_srgb,var(--et-surface-interaction-solid)_5%,transparent)] px-3.5"
    >
      <ethlete-checkouts #checkouts [remembered]="remembered" (pick)="setCheckout($event)" />

      <button (click)="reload()" et-button type="button" variant="transparent" color="surface" size="xs">Reload</button>

      @if (trouble(); as message) {
        <span [title]="message" [class]="STATUS_ITEM" [etProvideColor]="errorTheme()">
          <span class="overflow-hidden text-ellipsis text-(--et-theme-color-ink-solid)">{{ message }}</span>
        </span>
      }

      <span class="flex-1"></span>

      <ethlete-update-button />
      <ethlete-update-check-button />

      @if (renderQueue.count(); as rendering) {
        <span [class]="STATUS_ITEM" data-rendering>
          <i class="size-1.5 shrink-0 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></i>
          Rendering {{ rendering }} {{ rendering === 1 ? 'frame' : 'frames' }}
        </span>
      }

      @if (queueLine(); as line) {
        <span [class]="STATUS_ITEM" title="Shots the design server draws, and the age of the oldest" data-design-queue>
          <i class="size-1.5 shrink-0 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></i>
          {{ line }}
        </span>
      }

      @if (failures().length) {
        <span [title]="failureNote()" [class]="STATUS_ITEM" [etProvideColor]="errorTheme()" data-draw-failures>
          <span class="text-(--et-theme-color-ink-solid)">{{ failures().length }} failed</span>
        </span>
      }

      @if (serverLine(); as line) {
        <span [title]="serverNote()" [class]="STATUS_ITEM" data-server-line>
          <i
            [style.background]="server()?.listening ? 'var(--accent)' : 'var(--et-surface-color-subtle-solid)'"
            [class.animate-pulse]="server()?.listening && !serverReady()"
            [attr.data-server-starting]="server()?.listening && !serverReady() ? '' : null"
            class="size-1.5 shrink-0 rounded-full"
          ></i>
          <span class="overflow-hidden text-ellipsis">{{ line }}</span>
        </span>
      }

      @if (server(); as state) {
        @if (state.listening && (state.stale || state.foreign)) {
          <button
            [disabled]="serverBusy()"
            (click)="restartServer()"
            et-button
            type="button"
            variant="transparent"
            color="surface"
            size="xs"
          >
            Restart
          </button>
        }

        @if (state.listening && state.managed) {
          <button (click)="stopServer()" et-button type="button" variant="transparent" color="surface" size="xs">
            Stop
          </button>
        } @else if (!state.listening) {
          <button
            [disabled]="serverBusy()"
            (click)="startServer()"
            et-button
            type="button"
            variant="transparent"
            color="surface"
            size="xs"
          >
            Start
          </button>
        }
      }
    </footer>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CheckoutsComponent,
    NgTemplateOutlet,
    ProvideColorDirective,
    ShellPageComponent,
    SystemViewComponent,
    UpdateButtonComponent,
    UpdateCheckButtonComponent,
  ],
  host: {
    class: 'grid h-dvh grid-rows-[minmax(0,1fr)_auto] bg-(--et-surface-background-solid) text-text',
  },
})
export class StudioViewComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  private destroyRef = inject(DestroyRef);
  protected renderQueue = injectFrameRenderQueue();

  protected readonly STATUS_ITEM = STATUS_ITEM;
  protected remembered = rememberedView().checkout ?? '';

  public checkout = signal('');
  protected projectName = computed(() => folderNameOf(this.checkout()));
  protected serverPanel = signal<'open' | 'hidden'>('open');
  protected design = signal<Project | null>(null);
  protected server = signal<ServerState | null>(null);
  protected serverBusy = signal(false);
  protected trouble = signal('');
  protected epoch = signal(0);
  protected lists = signal(NO_LIST_REVISIONS);
  public frameRevisions = signal(NO_FRAME_REVISIONS);

  private foreignWatch: Subscription | null = null;

  private listeningPort = computed(() => {
    const state = this.server();

    return state?.listening ? state.port : null;
  });

  private designQueue = toSignal(
    toObservable(this.listeningPort).pipe(switchMap((port) => (port === null ? of(null) : designQueue$(port)))),
    { initialValue: null },
  );

  private serverAnswered = toSignal(
    toObservable(this.listeningPort).pipe(switchMap((port) => (port === null ? of(false) : serverAnswers$(port)))),
    { initialValue: false },
  );

  protected serverReady = computed(() => this.listeningPort() !== null && this.serverAnswered());

  protected queueLine = computed(() => queueLineOf(this.designQueue()));

  protected failures = computed(() =>
    failuresOf({
      queue: this.designQueue(),
      failingFrames: Object.keys(this.frameRevisions().failing),
      now: Date.now(),
    }),
  );

  protected failureNote = computed(() => this.failures().join('\n'));

  protected serverLine = computed(() => {
    const state = this.server();

    if (!state) return '';
    if (this.serverBusy()) return `Design server ${state.port} · starting`;

    if (!state.listening) return `Design server ${state.port} · stopped`;

    return [
      `Design server ${state.port}`,
      state.foreign ? 'not started by Studio' : '',
      state.stale ? 'stale' : this.serverAnswered() ? 'running' : 'starting',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected serverDown = computed(() => {
    const state = this.server();

    return state && !state.listening && !this.serverBusy() ? state : null;
  });

  protected serverStarting = computed(
    () => !!this.server() && (this.server()?.listening ? !this.serverReady() : this.serverBusy()),
  );

  protected downLog = computed(() => (this.serverDown()?.log ?? []).slice(-10).join('\n'));

  protected watcherHint = computed(() =>
    (this.serverDown()?.log ?? []).some((line) => /\b(EMFILE|ENOSPC)\b.*\bwatch\b/.test(line)),
  );

  protected serverNote = computed(() => {
    const state = this.server();

    return state && !state.listening ? state.log.slice(-5).join(' · ') : '';
  });

  constructor() {
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

  protected runShellAction(action: ShellAction, checkouts: CheckoutsComponent) {
    if (action.kind === 'collapse') this.serverPanel.set('hidden');
    if (action.kind === 'section') this.serverPanel.set('open');
    if (action.kind === 'project') checkouts.chooseByName(action.name);
    if (action.kind === 'openProject') checkouts.toggle();
  }

  protected setCheckout(path: string) {
    this.checkout.set(path);
    this.design.set(null);
    this.foreignWatch?.unsubscribe();
    this.foreignWatch = null;
    rememberView({ checkout: path });
    this.read();
    this.readServer();
  }

  protected startServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.serverBusy.set(true);

    designServerStart$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        finalize(() => this.serverBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected restartServer() {
    const checkout = this.checkout();

    if (!checkout || this.serverBusy()) return;

    this.serverBusy.set(true);

    designServerRestart$(checkout)
      .pipe(
        tap((state) => {
          this.showServer(state);
          this.epoch.update((value) => value + 1);
        }),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        finalize(() => this.serverBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected stopServer() {
    const checkout = this.checkout();

    if (!checkout) return;

    designServerStop$(checkout)
      .pipe(
        tap((state) => this.showServer(state)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected reload() {
    this.absorbChanges([{ kind: 'all' }]);
    this.read();
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

    this.trouble.set('');

    designProject$(checkout)
      .pipe(
        tap((project) => {
          if (checkout === this.checkout()) this.design.set(project);
        }),
        catchError((error: unknown) => {
          if (checkout === this.checkout()) this.trouble.set(`${error}`);

          return of(null);
        }),
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
