import { Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Subscription, catchError, finalize, of, tap } from 'rxjs';
import { AgentDescriptor, AgentEvent, agentList$, agentRun$ } from '../../host/agent';
import { workspaceRoot$ } from '../../host/workspace';

@Component({
  selector: 'ethlete-agent-view',
  template: `
    <div class="flex min-h-0 grow flex-col gap-4 p-8">
      <h1 class="text-h2">Agent bridge</h1>

      @if (clis().length === 0) {
        <p class="text-et-surface-muted">No agent CLI answered on this machine. {{ trouble() }}</p>
      } @else {
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
        </div>
      }

      <div class="flex flex-wrap gap-2">
        <input
          [value]="where()"
          (input)="cwd.set(typed($event))"
          class="grow rounded border border-et-surface-border px-3 py-1 text-mono"
          placeholder="The checkout the agent works in"
        />
        <input
          [value]="model()"
          (input)="model.set(typed($event))"
          class="w-48 rounded border border-et-surface-border px-3 py-1"
          list="agent-models"
          placeholder="Model"
        />
        <datalist id="agent-models">
          @for (name of cli()?.suggestedModels ?? []; track name) {
            <option [value]="name"></option>
          }
        </datalist>
      </div>

      <textarea
        [value]="prompt()"
        (input)="prompt.set(typed($event))"
        class="h-24 rounded border border-et-surface-border p-3"
        placeholder="What should the agent do?"
      ></textarea>

      <div class="flex gap-2">
        <button
          [disabled]="running()"
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

      <ul
        class="flex grow flex-col gap-1 overflow-auto rounded border border-et-surface-border bg-et-surface-bg p-4 text-mono"
      >
        @for (event of events(); track $index) {
          <li>
            @switch (event.kind) {
              @case ('started') {
                <span class="text-et-surface-muted">{{ event.cli }} {{ event.model }} started</span>
              }
              @case ('action') {
                <span>{{ event.action }}</span> <span class="text-et-surface-muted">{{ event.detail }}</span>
              }
              @case ('message') {
                <span>{{ event.text }}</span>
              }
              @case ('failed') {
                <span>{{ event.message }}</span>
              }
              @case ('finished') {
                <span class="text-et-surface-muted">{{ event.ok ? 'finished' : 'stopped' }} {{ event.summary }}</span>
              }
            }
          </li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class AgentViewComponent {
  private destroyRef = inject(DestroyRef);
  protected trouble = signal('');

  protected clis = toSignal(
    agentList$().pipe(
      catchError((error: unknown) => {
        this.trouble.set(String(error));

        return of<AgentDescriptor[]>([]);
      }),
    ),
    { initialValue: [] },
  );

  public root = toSignal(
    workspaceRoot$().pipe(
      catchError((error: unknown) => {
        this.trouble.set(String(error));

        return of('');
      }),
    ),
    { initialValue: '' },
  );

  protected cli = signal<AgentDescriptor | null>(null);
  protected model = signal('');
  protected cwd = signal('');
  protected prompt = signal('');
  protected events = signal<AgentEvent[]>([]);
  protected running = signal(false);
  private run: Subscription | null = null;

  protected typed(event: Event) {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected pick(cli: AgentDescriptor) {
    this.cli.set(cli);
    this.model.set('');
  }

  protected where() {
    return this.cwd() || this.root();
  }

  protected send() {
    const cli = this.cli();
    const cwd = this.where();

    if (!cli || !cwd || !this.prompt().trim() || this.running()) return;

    this.events.set([]);
    this.running.set(true);

    this.run = agentRun$({
      cli: cli.id,
      model: this.model() || null,
      prompt: this.prompt(),
      cwd,
      resume: null,
      tools: null,
    })
      .pipe(
        tap((event) => this.record(event)),
        catchError((error: unknown) => {
          this.record({ kind: 'failed', message: String(error) });

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

  private record(event: AgentEvent) {
    this.events.update((events) => [...events, event]);
  }
}
