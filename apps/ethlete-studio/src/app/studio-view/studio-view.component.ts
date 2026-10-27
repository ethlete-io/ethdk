import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { EMPTY, Subscription, catchError, debounceTime, finalize, first, interval, of, switchMap, tap } from 'rxjs';
import {
  Project,
  ServerState,
  designChanges$,
  drawnChanges$,
  designProject$,
  designServerRestart$,
  designServerStart$,
  designServerState$,
  designServerStop$,
} from '../../host/design';
import { SystemViewComponent } from '../system-view/system-view.component';
import { UpdateButtonComponent } from '../update-button.component';
import { UpdateCheckButtonComponent } from '../update-check-button.component';
import { CheckoutsComponent } from './checkouts.component';
import { rememberView, rememberedView } from './remembered';

/** One edit lands as several file events, and an agent writes a whole round in a burst. */
const SETTLE_MS = 300;

const FOREIGN_SERVER_POLL_MS = 3000;

const STATUS_ITEM =
  'flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-[1.1rem] tracking-[0.02em] text-[var(--et-surface-color-subtle-solid)]';

@Component({
  selector: 'ethlete-studio-view',
  template: `
    @if (serverDown(); as down) {
      <div
        class="mx-auto mt-15 flex w-full max-w-180 flex-col items-start gap-2.5 px-5 text-[1.2rem] text-[var(--et-surface-color-muted-solid)]"
        role="alert"
      >
        <h3 class="m-0 text-[1.4rem] text-[var(--et-surface-color-solid)]">The design server stopped</h3>
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
      <div class="mx-auto mt-15 w-full max-w-180 px-5">
        <h3 class="m-0 text-[1.4rem]">The design server is starting</h3>
      </div>
    } @else {
      <ethlete-system-view
        [port]="server()?.listening ? (design()?.port ?? null) : null"
        [epoch]="epoch()"
        [checkout]="checkout()"
        [projectThemes]="design()?.themes ?? {}"
        [tick]="tick()"
      />
    }

    <footer
      class="flex h-8 items-center gap-4 border-t border-[var(--et-surface-border-solid)] bg-[color-mix(in_srgb,var(--et-surface-interaction-solid)_5%,transparent)] px-3.5"
    >
      <ethlete-checkouts [remembered]="remembered" (pick)="setCheckout($event)" />

      <button (click)="reload()" et-button type="button" variant="transparent" color="surface" size="xs">Reload</button>

      @if (trouble(); as message) {
        <span [title]="message" [class]="STATUS_ITEM" etProvideColor="danger">
          <span class="overflow-hidden text-ellipsis text-[var(--et-theme-color-ink-solid)]">{{ message }}</span>
        </span>
      }

      <span class="flex-1"></span>

      <ethlete-update-button />
      <ethlete-update-check-button />

      @if (serverLine(); as line) {
        <span [title]="serverNote()" [class]="STATUS_ITEM" data-server-line>
          <i
            [style.background]="
              server()?.listening ? 'var(--et-theme-color-primary-solid)' : 'var(--et-surface-color-subtle-solid)'
            "
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
    ProvideColorDirective,
    SystemViewComponent,
    UpdateButtonComponent,
    UpdateCheckButtonComponent,
  ],
  host: {
    class:
      'grid h-dvh grid-rows-[minmax(0,1fr)_auto] bg-[var(--et-surface-background-solid)] text-[var(--et-surface-color-solid)]',
  },
})
export class StudioViewComponent {
  private destroyRef = inject(DestroyRef);

  protected readonly STATUS_ITEM = STATUS_ITEM;
  protected remembered = rememberedView().checkout ?? '';

  public checkout = signal('');
  protected design = signal<Project | null>(null);
  protected server = signal<ServerState | null>(null);
  protected serverBusy = signal(false);
  protected trouble = signal('');
  protected epoch = signal(0);
  protected tick = signal(0);

  private watch: Subscription | null = null;
  private foreignWatch: Subscription | null = null;

  private listeningPort = computed(() => {
    const state = this.server();

    return state?.listening ? state.port : null;
  });

  protected serverLine = computed(() => {
    const state = this.server();

    if (!state) return '';
    if (this.serverBusy()) return `Design server ${state.port} · starting`;

    if (!state.listening) return `Design server ${state.port} · stopped`;

    return [
      `Design server ${state.port}`,
      state.foreign ? 'not started by Studio' : '',
      state.stale ? 'stale' : 'running',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected serverDown = computed(() => {
    const state = this.server();

    return state && !state.listening && !this.serverBusy() ? state : null;
  });

  protected serverStarting = computed(() => !!this.server() && !this.server()?.listening && this.serverBusy());

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
        switchMap((port) => (port === null ? EMPTY : drawnChanges$(port).pipe(catchError(() => EMPTY)))),
        debounceTime(SETTLE_MS),
        tap(() => this.tick.update((value) => value + 1)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected setCheckout(path: string) {
    this.checkout.set(path);
    this.design.set(null);
    this.foreignWatch?.unsubscribe();
    this.foreignWatch = null;
    rememberView({ checkout: path });
    this.read();
    this.readServer();
    this.watchChanges();
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
    this.tick.update((value) => value + 1);
    this.read();
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

  private watchChanges() {
    const checkout = this.checkout();

    this.watch?.unsubscribe();
    this.watch = null;

    if (!checkout) return;

    this.watch = designChanges$(checkout)
      .pipe(
        debounceTime(SETTLE_MS),
        tap(() => this.tick.update((value) => value + 1)),
        switchMap(() => designProject$(checkout).pipe(catchError(() => EMPTY))),
        tap((project) => this.absorb(project)),
        catchError(() => EMPTY),
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
        switchMap(() => designServerState$(checkout).pipe(catchError(() => EMPTY))),
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
