import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { EMPTY, Subscription, catchError, debounceTime, finalize, map, of, switchMap, tap } from 'rxjs';
import { AgentDescriptor, AgentEvent, AgentTools, agentList$, agentRun$ } from '../../host/agent';
import {
  AddedOptions,
  Call,
  CallMode,
  CallOption,
  Project,
  ServerState,
  Verdict,
  designCheck$,
  designAddOptions$,
  designChanges$,
  designProject$,
  designServerStart$,
  designServerState$,
  designServerStop$,
  designSetMode$,
  designSetVerdict$,
  frameUrl,
} from '../../host/design';
import { workspaceRoot$ } from '../../host/workspace';
import { Verb, handoffDraft, opensARound, promptDraft, verbLabel, verdictOf } from './prompt-draft';
import { featureGroups, openOptions, projectOf, projectSummaries } from './grouping';
import { ProjectPickerComponent } from './project-picker.component';
import {
  CONTEXT_LIMIT,
  HANDOFF_AT,
  SessionTable,
  Turn,
  fullness,
  sessionKey,
  storedSessions,
  withTurn,
  writeSessions,
} from './sessions';
import { CallOrder, rememberView, rememberedView } from './remembered';

const THUMB_WIDTH = 180;

/** The design server reports no frame height, so a tile assumes the 16:9 window a call draws. */
const THUMB_ASPECT = 9 / 16;

/**
 * How long the calls root has to stay quiet before the list is read again. One edit lands as
 * several file events, and an agent writes a whole round of variants in a burst.
 */
const SETTLE_MS = 300;

@Component({
  selector: 'ethlete-call-view',
  template: `
    <div class="studio__body">
      <aside [etProvideSurface]="'dark-elevated'" class="studio__explorer">
        <div class="studio__explorer-head">
          <div class="studio__project">
            <h1>{{ project() || 'Calls' }}</h1>

            @if (project()) {
              <button (click)="closeProject()" class="studio__project-switch" type="button">
                Projects
                <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
              </button>
            }
          </div>

          <div class="studio__search">
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input [value]="filter()" (input)="filter.set(typed($event))" placeholder="Search calls" />
          </div>
        </div>

        <div class="flex min-h-0 flex-col gap-2 overflow-auto p-4">
          <div class="flex gap-2">
            @for (choice of ORDERS; track choice.key) {
              <button
                [class.bg-et-surface-bg]="order() === choice.key"
                (click)="setOrder(choice.key)"
                class="grow rounded border border-et-surface-border px-3 py-1"
                type="button"
              >
                {{ choice.label }}
              </button>
            }
          </div>

          <ul class="rounded border border-et-surface-border">
            @for (feature of features(); track feature.name) {
              <li>
                <h2
                  class="sticky top-0 flex justify-between gap-2 border-b border-et-surface-border bg-et-surface-bg px-3 py-2"
                >
                  <span>{{ feature.name }}</span>
                  <span class="text-et-surface-muted">{{ feature.open }} open</span>
                </h2>

                <ul>
                  @for (call of feature.calls; track call.slug) {
                    <li>
                      <button
                        [class.bg-et-surface-bg]="call.slug === slug()"
                        [class.text-et-surface-muted]="settled(call) === call.options.length"
                        (click)="openCall(call)"
                        class="flex w-full flex-col gap-1 border-b border-et-surface-border p-3 text-left"
                        type="button"
                      >
                        <span class="text-et-surface-muted">{{ call.eyebrow }}</span>
                        <span>{{ call.headline }}</span>
                        <span class="text-et-surface-muted">
                          {{ settled(call) }} of {{ call.options.length }} settled
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              </li>
            } @empty {
              <li class="p-3 text-et-surface-muted">No call matches.</li>
            }
          </ul>
        </div>
      </aside>

      <main class="flex min-h-0 flex-col gap-3 p-8">
        @if (!project()) {
          <ethlete-project-picker [projects]="projects()" (pick)="openProject($event)" />
        } @else if (call(); as open) {
          <div class="flex min-h-0 grow gap-4">
            <div class="flex w-48 shrink-0 flex-col gap-2.5 overflow-auto">
              @for (tile of tiles(); track tile.key) {
                <button
                  [style.opacity]="tile.verdict === 'rejected' ? 0.32 : 1"
                  [class.border-et-surface-interaction-ink]="tile.key === optionKey()"
                  (click)="openOption(tile)"
                  class="flex shrink-0 flex-col gap-1.5 rounded border border-et-surface-border bg-et-surface-bg p-1.5 text-left"
                  type="button"
                >
                  <span
                    [class.border-et-brand]="tile.verdict === 'chosen'"
                    [style.height.px]="THUMB_HEIGHT"
                    class="relative block w-full overflow-hidden rounded-sm border border-transparent"
                  >
                    @if (tile.source; as source) {
                      <iframe
                        [src]="source"
                        [style.width.px]="open.frameWidth"
                        [style.height.px]="thumbFrameHeight()"
                        [style.transform]="thumbTransform()"
                        class="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                        tabindex="-1"
                        title="The variant, drawn small"
                      ></iframe>
                    }
                  </span>
                  <span [class.text-et-brand]="tile.verdict === 'chosen'" class="text-small text-et-surface-muted">{{
                    tile.name
                  }}</span>
                </button>
              }
            </div>

            <div class="flex min-h-0 grow flex-col gap-3">
              @if (option(); as drawn) {
                <div class="flex min-h-0 grow overflow-auto">
                  <div [style.width.px]="open.frameWidth" class="relative min-h-0 shrink-0">
                    @for (frame of frames(); track frame.key) {
                      <iframe
                        [src]="frame.source"
                        [class.opacity-0]="frame.key !== optionKey()"
                        [class.pointer-events-none]="frame.key !== optionKey()"
                        class="absolute inset-0 h-full w-full rounded border border-et-surface-border bg-et-surface-bg transition-opacity"
                        title="The drawn option"
                      ></iframe>
                    }
                  </div>
                </div>

                <div class="flex flex-wrap items-baseline gap-3">
                  <span [class.text-et-brand]="drawn.verdict === 'chosen'">{{ drawn.name }}</span>
                  @if (drawn.verdict) {
                    <span class="text-small text-et-surface-muted">{{ drawn.verdict }}</span>
                  }
                  @if (check(); as checked) {
                    <span [class.text-et-danger-ink]="!checked.ok" class="text-small text-et-surface-muted">
                      {{ checked.ok ? 'check passed' : 'check failed' }}
                    </span>
                  } @else {
                    <span class="text-small text-et-surface-muted">not checked</span>
                  }
                  <span class="text-et-surface-muted text-mono">{{ address() }}</span>
                  <button
                    (click)="switchMode(open)"
                    class="rounded border border-et-surface-border px-2 text-small"
                    title="The mode every variant of this call is drawn in"
                    type="button"
                  >
                    Mode: {{ open.mode }}
                  </button>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  @for (verb of VERBS; track verb) {
                    <button
                      (click)="draft(verb)"
                      class="rounded border border-et-surface-border px-3 py-1"
                      type="button"
                    >
                      {{ label(verb) }}
                    </button>
                  }
                  <button
                    (click)="write(drawn, null)"
                    class="rounded border border-et-surface-border px-3 py-1"
                    type="button"
                  >
                    Open again
                  </button>
                </div>

                @if (formVerb(); as verb) {
                  <div class="flex flex-wrap items-center gap-2 rounded border border-et-surface-border p-3">
                    <span>{{ label(verb) }}</span>
                    <label class="flex items-center gap-2">
                      How many
                      <input
                        [value]="count()"
                        (input)="setCount($event)"
                        class="w-16 rounded border border-et-surface-border px-3 py-1"
                        max="8"
                        min="1"
                        type="number"
                      />
                    </label>
                    <input
                      [value]="question()"
                      (input)="question.set(typed($event))"
                      class="grow rounded border border-et-surface-border px-3 py-1"
                      placeholder="What this round asks"
                    />
                    <button
                      [disabled]="making() || !question().trim()"
                      (click)="create()"
                      class="rounded border border-et-surface-border px-3 py-1 disabled:opacity-50"
                      type="button"
                    >
                      Create and draft
                    </button>
                    <button
                      (click)="formVerb.set(null)"
                      class="rounded border border-et-surface-border px-3 py-1"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                }
              }
            </div>
          </div>
        }
      </main>

      <aside [etProvideSurface]="'dark-elevated'" class="studio__chat">
        <header class="studio__chat-head">
          <b>Chat</b>
          <span>{{ call()?.eyebrow }}</span>
        </header>

        <ul #thread class="flex min-h-0 flex-col gap-3 overflow-auto p-4">
          @for (turn of turns(); track $index) {
            <li>
              @switch (turn.kind) {
                @case ('ask') {
                  <p class="ml-3 border-l-2 border-et-surface-border pl-3 text-small break-words whitespace-pre-wrap">
                    {{ turn.text }}
                  </p>
                }
                @case ('say') {
                  <p class="text-small break-words whitespace-pre-wrap">{{ turn.text }}</p>
                }
                @case ('act') {
                  <p class="flex gap-2 overflow-hidden text-mono">
                    <span [class.text-et-brand]="$index === liveTurn()">{{ turn.action }}</span>
                    <span class="truncate text-et-surface-muted">{{ turn.detail }}</span>
                  </p>
                }
                @case ('note') {
                  <p class="text-et-surface-muted text-small">{{ turn.text }}</p>
                }
              }
            </li>
          } @empty {
            <li class="text-et-surface-muted">Nothing said in this call yet.</li>
          }
        </ul>

        <div class="flex flex-col gap-2 border-t border-et-surface-border p-4">
          <textarea
            [value]="prompt()"
            (input)="prompt.set(typed($event))"
            class="h-32 rounded border border-et-surface-border p-3"
            placeholder="A verb writes the first draft here. Change it, then send it."
          ></textarea>

          <div class="flex flex-wrap items-center gap-2">
            @if (resume(); as id) {
              <span
                [class.text-et-surface-muted]="!full()"
                [title]="(session()?.tokens ?? 0) + ' of ' + LIMIT + ' tokens'"
                class="flex grow items-center gap-2 text-mono"
              >
                {{ id.slice(0, 8) }}
                <span class="block h-1 grow rounded bg-et-surface-border">
                  <span
                    [class.bg-et-brand]="full()"
                    [class.bg-et-surface-subtle]="!full()"
                    [style.width.%]="fill()"
                    class="block h-full rounded"
                  ></span>
                </span>
                {{ sessionSize() }}
              </span>
              @if (full()) {
                <button
                  [disabled]="running()"
                  (click)="handOff()"
                  class="rounded border border-et-brand px-3 py-1 text-et-brand-ink disabled:opacity-50"
                  type="button"
                >
                  Hand off
                </button>
              }
              <button (click)="forgetSession()" class="rounded border border-et-surface-border px-3 py-1" type="button">
                New session
              </button>
            }
            <button
              [disabled]="running() || !prompt().trim() || !cli()"
              (click)="send()"
              class="ml-auto rounded border border-et-surface-border px-3 py-1"
              type="button"
            >
              Send
            </button>
            <button
              [disabled]="!running()"
              (click)="stop()"
              class="rounded border border-et-surface-border px-3 py-1"
              type="button"
            >
              Stop
            </button>
          </div>
        </div>
      </aside>
    </div>

    <footer class="studio__status">
      <input
        [value]="checkout()"
        (change)="setCheckout(typed($event))"
        class="studio__checkout"
        placeholder="The checkout the design work lives in"
        title="The checkout the design work lives in"
      />

      <button (click)="reload()" class="studio__status-button" type="button">
        <svg viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 1 1-2.4-5.7" />
          <path d="M20 4v4h-4" />
        </svg>
        Reload
      </button>

      @if (trouble(); as message) {
        <span [etProvideColor]="'danger'" [title]="message" class="studio__status-item studio__status-item--trouble">
          <span>{{ message }}</span>
        </span>
      }

      <span class="studio__status-spacer"></span>

      @if (serverLine(); as line) {
        <span [title]="serverNote()" class="studio__status-item">
          <i [class.studio__dot--off]="!server()?.listening" class="studio__dot"></i>
          <span>{{ line }}</span>
        </span>
      }

      @if (server(); as state) {
        @if (state.listening && state.managed) {
          <button (click)="stopServer()" class="studio__status-button" type="button">Stop</button>
        } @else if (!state.listening) {
          <button [disabled]="serverBusy()" (click)="startServer()" class="studio__status-button" type="button">
            Start
          </button>
        }
      }

      <span class="studio__status-item">
        <select
          [value]="cli()?.id ?? ''"
          [disabled]="!clis().length"
          (change)="pickById(typed($event))"
          class="studio__status-select"
          title="The agent CLI a run goes to"
        >
          @for (found of clis(); track found.id) {
            <option [value]="found.id">{{ found.label }} {{ found.version }}</option>
          } @empty {
            <option value="">No agent CLI</option>
          }
        </select>

        <select
          [value]="model()"
          [disabled]="!cli()"
          (change)="model.set(typed($event))"
          class="studio__status-select"
          title="The model the run asks for"
        >
          <option value="">CLI default</option>
          @for (name of cli()?.suggestedModels ?? []; track name) {
            <option [value]="name">{{ name }}</option>
          }
        </select>
      </span>
    </footer>
  `,
  styleUrl: './call-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProjectPickerComponent, ProvideColorDirective, ProvideSurfaceDirective],
  host: { class: 'studio' },
})
export class CallViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  private thread = viewChild<ElementRef<HTMLElement>>('thread');

  protected checkout = signal('');
  protected project = signal('');
  protected slug = signal('');
  protected optionKey = signal('');
  protected trouble = signal('');
  protected prompt = signal('');
  protected model = signal('');
  protected cli = signal<AgentDescriptor | null>(null);
  protected running = signal(false);
  private handingOff = signal(false);
  protected server = signal<ServerState | null>(null);
  private sessions = signal<SessionTable>(storedSessions());
  protected serverBusy = signal(false);

  protected filter = signal('');
  protected order = signal<CallOrder>(rememberedView().order ?? 'name');

  protected formVerb = signal<Verb | null>(null);
  protected count = signal(3);
  protected question = signal('');
  protected making = signal(false);

  protected readonly VERBS: Verb[] = ['accept', 'iterate', 'reject', 'more'];

  protected readonly ORDERS: { key: CallOrder; label: string }[] = [
    { key: 'name', label: 'By name' },
    { key: 'open', label: 'Open first' },
  ];

  private run: Subscription | null = null;
  private watch: Subscription | null = null;
  private design = signal<Project | null>(null);
  private epoch = signal(0);

  private checkEpoch = signal(0);

  /** What the last check said about the variant under study. A run that never checked leaves `null`. */
  protected check = toSignal(
    toObservable(
      computed(() => ({
        checkout: this.checkout(),
        slug: this.slug(),
        option: this.optionKey(),
        seen: this.checkEpoch(),
      })),
    ).pipe(
      switchMap(({ checkout, slug, option }) =>
        checkout && slug && option
          ? designCheck$({ checkout, slug, option }).pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected clis = toSignal(
    agentList$().pipe(
      tap((found) => this.pick(found[0] ?? null)),
      catchError(() => of<AgentDescriptor[]>([])),
    ),
    { initialValue: [] },
  );

  protected serverLine = computed(() => {
    const state = this.server();

    if (!state) return '';
    if (this.serverBusy()) return `Design server ${state.port} · starting`;

    return `Design server ${state.port} · ${state.listening ? 'running' : 'stopped'}`;
  });

  protected serverLog = computed(() => {
    const state = this.server();

    return state && !state.listening ? state.log.slice(-5) : [];
  });

  /** What a stopped server last said, read by hovering its line in the status bar. */
  protected serverNote = computed(() => this.serverLog().join(' · '));

  public calls = computed(() => this.design()?.calls ?? []);

  protected projects = computed(() => projectSummaries(this.calls()));

  protected features = computed(() =>
    featureGroups({ calls: this.calls(), project: this.project(), term: this.filter(), order: this.order() }),
  );

  protected call = computed(() => this.calls().find((call) => call.slug === this.slug()) ?? null);

  protected option = computed(() => this.call()?.options.find((o) => o.key === this.optionKey()) ?? null);

  protected address = computed(() => {
    const port = this.design()?.port;
    const option = this.option();

    return port && option ? frameUrl({ port, slug: this.slug(), option: option.key }) : '';
  });

  /**
   * One frame per option of the open call, all of them loaded. Switching an option changes which
   * one is opaque, so a drawing never reloads. The list changes only with the call itself, which is
   * what keeps each `src` stable across a redraw.
   */
  protected frames = computed(() => {
    const call = this.call();
    const port = this.design()?.port;

    if (!call || !port) return [];

    const epoch = this.epoch();

    return call.options.map((option) => ({
      key: option.key,
      source: this.sanitizer.bypassSecurityTrustResourceUrl(
        frameUrl({ port, slug: call.slug, option: option.key, epoch }),
      ),
    }));
  });

  protected readonly THUMB_HEIGHT = Math.round(THUMB_WIDTH * THUMB_ASPECT);

  /** Every variant of the open call, each with the frame its tile draws small. */
  protected tiles = computed(() => {
    const call = this.call();

    if (!call) return [];

    const sources = new Map(this.frames().map((frame) => [frame.key, frame.source]));

    return call.options.map((option) => ({ ...option, source: sources.get(option.key) ?? null }));
  });

  protected thumbFrameHeight = computed(() => Math.round((this.call()?.frameWidth ?? 0) * THUMB_ASPECT));

  protected thumbTransform = computed(() => {
    const width = this.call()?.frameWidth ?? 0;

    return `scale(${width ? THUMB_WIDTH / width : 1})`;
  });

  public conversation = computed(() => sessionKey({ slug: this.slug(), cli: this.cli()?.id ?? '' }));

  protected session = computed(() => this.sessions()[this.conversation()] ?? null);

  /** The session the next run continues. `null` starts a new conversation. */
  protected resume = computed(() => this.session()?.id ?? null);

  /** Every turn the open conversation holds, oldest first. A reload reads them back. */
  protected turns = computed(() => this.session()?.turns ?? []);

  /** The turn the agent is on now, so the rail marks it. `-1` while no run is going. */
  protected liveTurn = computed(() => (this.running() ? this.turns().length - 1 : -1));

  protected readonly LIMIT = CONTEXT_LIMIT;

  protected fill = computed(() => Math.min(100, Math.round(fullness(this.session()) * 100)));

  protected sessionSize = computed(() => `${Math.round((this.session()?.tokens ?? 0) / 1000)}k`);

  /** A session this full pays the long-context rate on its next turn, so it has to hand over. */
  protected full = computed(() => fullness(this.session()) >= HANDOFF_AT);

  /** What the run can reach through Studio's own tool server. A run without an open variant gets none. */
  private tools = computed<AgentTools | null>(() => {
    const design = this.design();
    const option = this.option();

    if (!design || !option) return null;

    return { call: this.slug(), variant: option.key, port: design.port, callsRoot: design.callsRoot };
  });

  private callDir = computed(() => {
    const root = this.design()?.callsRoot;

    return root ? `${root}/${this.slug()}` : '';
  });

  constructor() {
    afterRenderEffect(() => {
      const count = this.turns().length;
      const rail = this.thread()?.nativeElement;

      if (rail && count) rail.scrollTop = rail.scrollHeight;
    });

    workspaceRoot$()
      .pipe(
        catchError(() => of('')),
        tap((root) => this.setCheckout(root)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected settled(call: Call) {
    return call.options.length - openOptions(call);
  }

  protected setOrder(order: CallOrder) {
    this.order.set(order);
    rememberView({ order });
  }

  protected label(verb: Verb) {
    return verbLabel[verb];
  }

  protected typed(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected setCheckout(path: string) {
    this.checkout.set(path);
    this.read();
    this.readServer();
    this.watchCalls();
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

  protected openProject(name: string) {
    this.project.set(name);
    rememberView({ checkout: this.checkout(), project: name });
    this.openIn({ project: name, wanted: this.design()?.defaultCall ?? '' });
  }

  protected closeProject() {
    this.project.set('');
    this.slug.set('');
    this.optionKey.set('');
    rememberView({ project: '' });
  }

  protected openCall(call: Call, option = call.options[0]?.key ?? '') {
    this.formVerb.set(null);
    this.slug.set(call.slug);
    this.optionKey.set(option);
    rememberView({ checkout: this.checkout(), slug: call.slug, option });
  }

  protected openOption(option: CallOption) {
    this.optionKey.set(option.key);
    rememberView({ checkout: this.checkout(), slug: this.slug(), option: option.key });
  }

  protected pick(cli: AgentDescriptor | null) {
    this.cli.set(cli);
    this.model.set('');
  }

  protected pickById(id: string) {
    this.pick(this.clis().find((found) => found.id === id) ?? null);
  }

  protected setCount(event: Event) {
    const value = Number.parseInt(this.typed(event), 10);

    this.count.set(Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : 1);
  }

  protected draft(verb: Verb) {
    if (opensARound(verb)) {
      this.formVerb.set(verb);
      this.question.set('');

      return;
    }

    this.settle(verb);
  }

  /** Opens the round the verb asked for, then drafts a prompt that names the files Studio made. */
  protected create() {
    const verb = this.formVerb();
    const call = this.call();

    if (!verb || !call || this.making()) return;

    this.making.set(true);

    designAddOptions$({
      checkout: this.checkout(),
      slug: call.slug,
      count: this.count(),
      roundTitle: this.question().trim(),
    })
      .pipe(
        switchMap((made) => designProject$(this.checkout()).pipe(map((design) => ({ made, design })))),
        tap(({ made, design }) => {
          this.design.set(design);
          this.formVerb.set(null);
          this.settle(verb, made);
        }),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        finalize(() => this.making.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected write(option: CallOption, verdict: Verdict | null) {
    designSetVerdict$({ checkout: this.checkout(), slug: this.slug(), option: option.key, verdict })
      .pipe(
        switchMap(() => designProject$(this.checkout())),
        tap((design) => this.design.set(design)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Turns the call over to the other mode. Only the prompt of the next round reads it, so a
   * variant already drawn keeps the picture it was drawn with.
   */
  protected switchMode(call: Call) {
    const mode: CallMode = call.mode === 'wireframe' ? 'design' : 'wireframe';

    designSetMode$({ checkout: this.checkout(), slug: call.slug, mode })
      .pipe(
        switchMap(() => designProject$(this.checkout())),
        tap((design) => this.design.set(design)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected send() {
    const cli = this.cli();
    const cwd = this.checkout();
    const prompt = this.prompt();

    if (!cli || !cwd || !prompt.trim() || this.running()) return;

    // Read once: a run keeps writing to the conversation it started in, even if the CLI changes.
    const key = this.conversation();

    this.keepTurn(key, { kind: 'ask', text: prompt });
    this.prompt.set('');
    this.running.set(true);

    this.run = agentRun$({
      cli: cli.id,
      model: this.model() || null,
      prompt,
      cwd,
      resume: this.resume(),
      tools: this.tools(),
    })
      .pipe(
        tap((event) => this.keepEvent(key, event)),
        catchError((error: unknown) => {
          this.keepTurn(key, { kind: 'note', text: String(error) });

          return EMPTY;
        }),
        finalize(() => {
          this.running.set(false);
          this.handingOff.set(false);
          this.reload();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected stop() {
    this.run?.unsubscribe();
    this.run = null;
  }

  /** Drops the conversation of the open call, so the next run starts a new one. */
  protected forgetSession() {
    this.keepSession(this.conversation(), null);
  }

  /**
   * Asks the full session to write its state next to the call, and drops it once it did. What went
   * out stays readable as the last turn of the rail.
   */
  protected handOff() {
    const call = this.call();

    if (!call || this.running()) return;

    this.prompt.set(handoffDraft({ call, dir: this.callDir() }));
    this.handingOff.set(true);
    this.send();
  }

  /** Reads the checkout again, which is how a call an agent just wrote reaches the list. */
  protected reload() {
    this.checkEpoch.update((seen) => seen + 1);
    this.read();
  }

  public read() {
    const checkout = this.checkout();

    if (!checkout) return;

    this.trouble.set('');

    designProject$(checkout)
      .pipe(
        tap((project) => this.show(project)),
        catchError((error: unknown) => {
          this.trouble.set(`${error}`);

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private settle(verb: Verb, made: AddedOptions | null = null) {
    const call = this.call();
    const option = this.option();

    if (!call || !option) return;

    this.prompt.set(promptDraft({ call, option, dir: this.callDir(), made }, verb));

    const verdict = verdictOf(verb);

    if (verdict) this.write(option, verdict);
  }

  /** Writes what one event says into the conversation the run started in. */
  private keepEvent(key: string, event: AgentEvent) {
    if (event.kind === 'session') this.keepSession(key, event.id);
    if (event.kind === 'context') this.keepContext(key, event.tokens);
    if (event.kind === 'message') this.keepTurn(key, { kind: 'say', text: event.text });
    if (event.kind === 'action') this.keepTurn(key, { kind: 'act', action: event.action, detail: event.detail });
    if (event.kind === 'failed') this.keepTurn(key, { kind: 'note', text: event.message });
    if (event.kind !== 'finished') return;

    if (!event.ok) this.keepTurn(key, { kind: 'note', text: event.summary || 'The run stopped.' });
    else if (this.handingOff()) this.keepSession(key, null);
  }

  private keepTurn(key: string, turn: Turn) {
    this.sessions.update((table) => {
      const next = { ...table, [key]: withTurn(table[key] ?? null, turn) };

      writeSessions(next);

      return next;
    });
  }

  private keepSession(key: string, id: string | null) {
    this.sessions.update((table) => {
      const next = { ...table };
      const open = table[key];

      if (id) next[key] = { id, tokens: open?.id === id ? open.tokens : 0, turns: open?.turns ?? [] };
      else delete next[key];

      writeSessions(next);

      return next;
    });
  }

  private keepContext(key: string, tokens: number) {
    this.sessions.update((table) => {
      const open = table[key];

      if (!open) return table;

      const next = { ...table, [key]: { ...open, tokens } };

      writeSessions(next);

      return next;
    });
  }

  /**
   * Reads the checkout again whenever its calls root changes, so a call or a variant written
   * outside this window shows up on its own. The reader keeps the call and the variant they are on.
   */
  private watchCalls() {
    const checkout = this.checkout();

    this.watch?.unsubscribe();
    this.watch = null;

    if (!checkout) return;

    this.watch = designChanges$(checkout)
      .pipe(
        debounceTime(SETTLE_MS),
        switchMap(() => designProject$(checkout).pipe(catchError(() => EMPTY))),
        tap((project) => this.absorb(project)),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Takes a reading nobody asked for. A project that reads the same is dropped: setting it again
   * hands every frame a new address, which reloads every drawing on it.
   */
  private absorb(project: Project) {
    if (JSON.stringify(project) === JSON.stringify(this.design())) return;

    const open = this.slug();

    this.design.set(project);

    if (open && !project.calls.some((call) => call.slug === open)) this.show(project);
  }

  private show(design: Project) {
    this.design.set(design);

    const last = rememberedView();
    const remembered = last.checkout === this.checkout() ? last : {};

    this.project.set(remembered.project ?? '');
    this.openIn({
      project: remembered.project ?? '',
      wanted: remembered.slug ?? design.defaultCall ?? '',
      option: remembered.option,
    });
  }

  /** Opens the wanted call of a project, or the project's first call when the wanted one is gone. */
  private openIn({ project, wanted, option }: { project: string; wanted: string; option?: string }) {
    if (!project) return;

    const inProject = this.calls().filter((entry) => projectOf(entry) === project);
    const call = inProject.find((entry) => entry.slug === wanted) ?? inProject[0];

    if (!call) return;

    this.openCall(call, call.options.some((entry) => entry.key === option) ? option : undefined);
  }

  /** A frame only draws once the port answers, so a checkout without a server gets one. */
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
  }
}
