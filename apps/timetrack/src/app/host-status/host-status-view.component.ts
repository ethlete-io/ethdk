import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BANNER_IMPORTS, BUTTON_IMPORTS, DESCRIPTION_LIST_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { AgentLogPass, TitleRepairReport, repairStoredTitles$ } from '@ethlete/timetrack';
import { catchError, combineLatest, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';

/** One row per pass, because each reads its own agent's logs and each converges on its own. */
const CURSOR_PASSES: { pass: AgentLogPass; label: string }[] = [
  { pass: 'agent-session', label: 'Claude Code session cursors' },
  { pass: 'spend-all', label: 'Claude Code spend cursors' },
  { pass: 'prompt', label: 'Claude Code prompt cursors' },
  { pass: 'codex-session', label: 'Codex session cursors' },
  { pass: 'codex-spend-all', label: 'Codex spend cursors' },
  { pass: 'codex-prompt', label: 'Codex prompt cursors' },
];

type CursorTally = { label: string; count: number };

type HostStatus =
  | { state: 'checking' }
  | { state: 'ready'; oldestEventAt: Date | null; cursors: CursorTally[]; compactedThrough: Date | null }
  | { state: 'failed'; message: string };

type TitleRepair =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'done'; report: TitleRepairReport }
  | { state: 'failed'; message: string };

/** Whether the encrypted store came up, and what it currently holds. */
@Component({
  selector: 'ethlete-host-status',
  template: `
    <div class="flex w-full max-w-7xl flex-col gap-3 p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-h3">Host</h2>
        <button (click)="recheck()" et-button variant="outline" size="sm">Re-check host</button>
      </div>

      @switch (status().state) {
        @case ('checking') {
          <div class="flex items-center gap-3 text-et-surface-muted">
            <et-spinner />
            <span class="text-base">Opening the encrypted store…</span>
          </div>
        }
        @case ('failed') {
          <et-banner [description]="failure()" type="error" heading="The host did not come up" />
        }
        @case ('ready') {
          <dl et-description-list>
            <dt>Oldest raw event</dt>
            <dd>{{ oldestEventAt() ?? 'none stored yet' }}</dd>
            <dt>Compacted through</dt>
            <dd>{{ compactedThrough() ?? 'nothing compacted yet' }}</dd>
            @for (tally of cursors(); track tally.label) {
              <dt>{{ tally.label }}</dt>
              <dd>{{ tally.count }}</dd>
            }
          </dl>

          <p class="text-small text-et-surface-subtle">The keychain answered and the database decrypted.</p>

          <h3 class="text-h4 mt-3">Titles collected before the redaction</h3>
          <p class="text-small text-et-surface-subtle">
            A window title is redacted on the way into the store, so a title collected before that rule existed still
            holds the query string of every URL in it. Run this once to apply the rule to what is already stored. It
            changes nothing else, and running it twice is free.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <button
              [disabled]="repair().state === 'running'"
              (click)="redactTitles()"
              et-button
              variant="outline"
              size="sm"
            >
              Redact stored titles
            </button>

            @switch (repair().state) {
              @case ('running') {
                <span class="flex items-center gap-2 text-small text-et-surface-muted">
                  <et-spinner />
                  Reading the stored titles…
                </span>
              }
              @case ('done') {
                <span class="text-small text-et-surface-muted">{{ repaired() }}</span>
              }
              @case ('failed') {
                <span class="text-small text-et-error">{{ repairFailure() }}</span>
              }
            }
          </div>
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, DESCRIPTION_LIST_IMPORTS, SpinnerComponent],
})
export class HostStatusViewComponent {
  private ports = injectHostPorts();
  private agentSessions = injectAgentSessionCollector();
  private windows = injectWindowCollector();
  private git = injectGitCollector();

  private destroyRef = inject(DestroyRef);

  private reload = signal(0);
  private probe = computed(() => ({
    reload: this.reload(),
    run: this.agentSessions.lastRun(),
    windows: this.windows.lastRun(),
    git: this.git.lastRun(),
  }));

  protected status = toSignal(
    toObservable(this.probe).pipe(
      switchMap(() =>
        combineLatest({
          oldestEventAt: this.ports.events.oldestEventAt$(),
          cursors: forkJoin(
            CURSOR_PASSES.map(({ pass, label }) =>
              this.ports.events.cursors$(pass).pipe(map((cursors): CursorTally => ({ label, count: cursors.length }))),
            ),
          ),
          compactedThrough: this.ports.events.compactedThrough$(),
        }).pipe(
          map((health): HostStatus => ({ state: 'ready', ...health })),
          catchError((error: unknown) =>
            of<HostStatus>({ state: 'failed', message: error instanceof Error ? error.message : String(error) }),
          ),
        ),
      ),
    ),
    { initialValue: { state: 'checking' } as HostStatus },
  );

  protected failure = computed(() => {
    const status = this.status();

    return status.state === 'failed' ? status.message : '';
  });

  protected oldestEventAt = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? (status.oldestEventAt?.toLocaleString() ?? null) : null;
  });

  protected compactedThrough = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? (status.compactedThrough?.toLocaleString() ?? null) : null;
  });

  protected cursors = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? status.cursors : [];
  });

  protected repair = signal<TitleRepair>({ state: 'idle' });

  protected repaired = computed(() => {
    const repair = this.repair();

    if (repair.state !== 'done') return '';

    const { scanned, rewritten } = repair.report;
    const read = `${scanned} stored ${scanned === 1 ? 'title' : 'titles'}`;

    return rewritten === 0 ? `Read ${read}. None held a query string.` : `Read ${read} and redacted ${rewritten}.`;
  });

  protected repairFailure = computed(() => {
    const repair = this.repair();

    return repair.state === 'failed' ? repair.message : '';
  });

  protected recheck() {
    this.reload.update((count) => count + 1);
  }

  protected redactTitles() {
    this.repair.set({ state: 'running' });

    repairStoredTitles$(this.ports.events)
      .pipe(
        map((report): TitleRepair => ({ state: 'done', report })),
        catchError((error: unknown) =>
          of<TitleRepair>({ state: 'failed', message: error instanceof Error ? error.message : String(error) }),
        ),
        tap((repair) => this.repair.set(repair)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
