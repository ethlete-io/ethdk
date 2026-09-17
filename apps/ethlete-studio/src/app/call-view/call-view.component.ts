import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { EMPTY, Subscription, catchError, finalize, of, switchMap, tap } from 'rxjs';
import { AgentDescriptor, AgentEvent, agentList$, agentRun$ } from '../../host/agent';
import { Call, CallOption, Project, Verdict, designProject$, designSetVerdict$, frameUrl } from '../../host/design';
import { workspaceRoot$ } from '../../host/workspace';
import { Verb, promptDraft, verbLabel, verdictOf } from './prompt-draft';
import { rememberCall, rememberedCall } from './remembered';

@Component({
  selector: 'ethlete-call-view',
  template: `
    <div class="flex h-dvh min-h-0 flex-col gap-4 p-8">
      <div class="flex flex-wrap items-baseline gap-4">
        <h1 class="text-h2">Calls</h1>
        <input
          [value]="checkout()"
          (change)="setCheckout(typed($event))"
          class="grow rounded border border-et-surface-border px-3 py-1 text-mono"
          placeholder="The checkout the design work lives in"
        />
      </div>

      @if (trouble(); as message) {
        <p class="text-et-surface-muted">{{ message }}</p>
      }

      <div class="flex min-h-0 grow gap-6">
        <ul class="w-80 shrink-0 overflow-auto rounded border border-et-surface-border">
          @for (call of calls(); track call.slug) {
            <li>
              <button
                [class.bg-et-surface-bg]="call.slug === slug()"
                (click)="openCall(call)"
                class="flex w-full flex-col gap-1 border-b border-et-surface-border p-3 text-left"
                type="button"
              >
                <span class="text-et-surface-muted">{{ call.eyebrow }}</span>
                <span>{{ call.headline }}</span>
                <span class="text-et-surface-muted">{{ settled(call) }} of {{ call.options.length }} settled</span>
              </button>
            </li>
          }
        </ul>

        @if (call(); as open) {
          <div class="flex min-h-0 grow flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              @for (option of open.options; track option.key) {
                <button
                  [class.bg-et-surface-bg]="option.key === optionKey()"
                  (click)="openOption(option)"
                  class="rounded border border-et-surface-border px-3 py-1"
                  type="button"
                >
                  {{ option.name }}
                  @if (option.verdict) {
                    <span class="text-et-surface-muted">{{ option.verdict }}</span>
                  }
                </button>
              }
            </div>

            @if (option(); as drawn) {
              <div class="flex flex-wrap items-center gap-2">
                @for (verb of VERBS; track verb) {
                  <button (click)="draft(verb)" class="rounded border border-et-surface-border px-3 py-1" type="button">
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
                <span class="text-et-surface-muted text-mono">{{ address() }}</span>
              </div>

              <div class="flex min-h-0 grow gap-3 overflow-auto">
                <iframe
                  [src]="source()"
                  [style.width.px]="open.frameWidth"
                  class="min-h-0 shrink-0 rounded border border-et-surface-border bg-et-surface-bg"
                  title="The drawn option"
                ></iframe>

                @if (events().length) {
                  <ul
                    class="flex w-96 shrink-0 flex-col gap-1 overflow-auto rounded border border-et-surface-border bg-et-surface-bg p-3 text-mono"
                  >
                    @for (event of events(); track $index) {
                      <li>
                        @switch (event.kind) {
                          @case ('started') {
                            <span class="text-et-surface-muted">{{ event.cli }} {{ event.model }} started</span>
                          }
                          @case ('action') {
                            <span>{{ event.action }}</span>
                            <span class="text-et-surface-muted">{{ event.detail }}</span>
                          }
                          @case ('message') {
                            <span>{{ event.text }}</span>
                          }
                          @case ('failed') {
                            <span>{{ event.message }}</span>
                          }
                          @case ('finished') {
                            <span class="text-et-surface-muted">
                              {{ event.ok ? 'finished' : 'stopped' }} {{ event.summary }}
                            </span>
                          }
                        }
                      </li>
                    }
                  </ul>
                }
              </div>

              <textarea
                [value]="prompt()"
                (input)="prompt.set(typed($event))"
                class="h-32 shrink-0 rounded border border-et-surface-border p-3"
                placeholder="A verb writes the first draft here. Change it, then send it."
              ></textarea>

              <div class="flex flex-wrap items-center gap-2">
                @for (found of clis(); track found.id) {
                  <button
                    [class.bg-et-surface-bg]="cli()?.id === found.id"
                    (click)="pick(found)"
                    class="rounded border border-et-surface-border px-3 py-1"
                    type="button"
                  >
                    {{ found.label }}
                    <span class="text-et-surface-muted">{{ found.version }}</span>
                  </button>
                }
                <input
                  [value]="model()"
                  (input)="model.set(typed($event))"
                  class="w-48 rounded border border-et-surface-border px-3 py-1"
                  list="call-models"
                  placeholder="Model"
                />
                <datalist id="call-models">
                  @for (name of cli()?.suggestedModels ?? []; track name) {
                    <option [value]="name"></option>
                  }
                </datalist>
                <button
                  [disabled]="running() || !prompt().trim() || !cli()"
                  (click)="send()"
                  class="rounded border border-et-surface-border px-3 py-1"
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
            }
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class CallViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  protected checkout = signal('');
  protected slug = signal('');
  protected optionKey = signal('');
  protected trouble = signal('');
  protected prompt = signal('');
  protected model = signal('');
  protected cli = signal<AgentDescriptor | null>(null);
  protected events = signal<AgentEvent[]>([]);
  protected running = signal(false);

  protected readonly VERBS: Verb[] = ['accept', 'iterate', 'reject', 'more'];

  private run: Subscription | null = null;
  private project = signal<Project | null>(null);

  protected clis = toSignal(
    agentList$().pipe(
      tap((found) => this.pick(found[0] ?? null)),
      catchError(() => of<AgentDescriptor[]>([])),
    ),
    { initialValue: [] },
  );

  protected calls = computed(() => this.project()?.calls ?? []);

  protected call = computed(() => this.calls().find((call) => call.slug === this.slug()) ?? null);

  protected option = computed(() => this.call()?.options.find((o) => o.key === this.optionKey()) ?? null);

  protected address = computed(() => {
    const port = this.project()?.port;
    const option = this.option();

    return port && option ? frameUrl({ port, slug: this.slug(), option: option.key }) : '';
  });

  protected source = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.address()));

  private callDir = computed(() => {
    const root = this.project()?.callsRoot;

    return root ? `${root}/${this.slug()}` : '';
  });

  constructor() {
    workspaceRoot$()
      .pipe(
        catchError(() => of('')),
        tap((root) => this.setCheckout(root)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected settled(call: Call) {
    return call.options.filter((option) => option.verdict).length;
  }

  protected label(verb: Verb) {
    return verbLabel[verb];
  }

  protected typed(event: Event) {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected setCheckout(path: string) {
    this.checkout.set(path);
    this.read();
  }

  protected openCall(call: Call, option = call.options[0]?.key ?? '') {
    this.slug.set(call.slug);
    this.optionKey.set(option);
    rememberCall({ checkout: this.checkout(), slug: call.slug, option });
  }

  protected openOption(option: CallOption) {
    this.optionKey.set(option.key);
    rememberCall({ checkout: this.checkout(), slug: this.slug(), option: option.key });
  }

  protected pick(cli: AgentDescriptor | null) {
    this.cli.set(cli);
    this.model.set(cli?.suggestedModels[0] ?? '');
  }

  protected draft(verb: Verb) {
    const call = this.call();
    const option = this.option();

    if (!call || !option) return;

    this.prompt.set(promptDraft({ call, option, dir: this.callDir() }, verb));

    const verdict = verdictOf(verb);

    if (verdict) this.write(option, verdict);
  }

  protected write(option: CallOption, verdict: Verdict | null) {
    designSetVerdict$({ checkout: this.checkout(), slug: this.slug(), option: option.key, verdict })
      .pipe(
        switchMap(() => designProject$(this.checkout())),
        tap((project) => this.project.set(project)),
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

    if (!cli || !cwd || !this.prompt().trim() || this.running()) return;

    this.events.set([]);
    this.running.set(true);

    this.run = agentRun$({ cli: cli.id, model: this.model() || null, prompt: this.prompt(), cwd })
      .pipe(
        tap((event) => this.events.update((events) => [...events, event])),
        catchError((error: unknown) => {
          this.events.update((events) => [...events, { kind: 'failed', message: String(error) }]);

          return EMPTY;
        }),
        finalize(() => this.running.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected stop() {
    this.run?.unsubscribe();
    this.run = null;
  }

  private show(project: Project) {
    this.project.set(project);

    const last = rememberedCall();
    const wanted =
      last?.checkout === this.checkout() ? last.slug : (project.defaultCall ?? project.calls[0]?.slug ?? '');
    const call = project.calls.find((entry) => entry.slug === wanted) ?? null;

    if (!call) return;

    const option = call.options.some((entry) => entry.key === last?.option) ? last?.option : undefined;

    this.openCall(call, option);
  }

  private read() {
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
}
