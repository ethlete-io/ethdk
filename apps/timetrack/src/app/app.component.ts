import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CARD_IMPORTS,
  DESCRIPTION_LIST_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { AgentSessionCollector } from '../collectors';
import { injectHostPorts } from '../host';

type HostStatus =
  | { state: 'checking' }
  | { state: 'ready'; oldestEventAt: Date | null; cursors: number; compactedThrough: Date | null }
  | { state: 'failed'; message: string };

@Component({
  selector: 'ethlete-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, CARD_IMPORTS, DESCRIPTION_LIST_IMPORTS, SpinnerComponent],
  template: `
    <main class="mx-auto flex max-w-[76rem] flex-col gap-8 p-10">
      <header class="flex flex-wrap items-baseline justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-h1">Timetrack</h1>
          <p class="text-small text-et-surface-muted">Local-first Jira and Tempo worklogs, rebuilt from evidence.</p>
        </div>

        <button (click)="recheck()" et-button variant="outline" size="sm">Re-check host</button>
      </header>

      <et-card variant="outlined">
        <h2 class="text-h3">Host</h2>

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
              <dt>Agent-session cursors</dt>
              <dd>{{ cursors() }}</dd>
            </dl>

            <p class="text-small text-et-surface-subtle">The keychain answered and the database decrypted.</p>
          }
        }
      </et-card>

      <et-card variant="outlined">
        <h2 class="text-h3">Agent sessions</h2>

        @if (collectorFailure(); as failure) {
          <et-banner [description]="failure" type="error" heading="The last collection failed" />
        }

        @if (lastRun(); as run) {
          <dl et-description-list>
            <dt>Last run</dt>
            <dd>{{ run.at.toLocaleTimeString() }}</dd>
            <dt>Samples stored</dt>
            <dd>{{ run.events }}</dd>
            <dt>Unparsed lines</dt>
            <dd>{{ run.unparsedLines }}</dd>
          </dl>
        } @else if (!isCollecting()) {
          <p class="text-small text-et-surface-muted">No run has finished yet.</p>
        }

        @if (isCollecting()) {
          <div class="flex items-center gap-3 text-et-surface-muted">
            <et-spinner />
            <span class="text-base">Reading the session logs…</span>
          </div>
        }
      </et-card>
    </main>
  `,
})
export class AppComponent {
  private readonly _ports = injectHostPorts();
  private readonly _collector = inject(AgentSessionCollector);
  private readonly _reload = signal(0);
  private readonly _probe = computed(() => ({ reload: this._reload(), run: this._collector.lastRun() }));

  protected readonly lastRun = this._collector.lastRun;
  protected readonly isCollecting = this._collector.isCollecting;
  protected readonly collectorFailure = this._collector.failure;

  protected readonly status = toSignal(
    toObservable(this._probe).pipe(
      switchMap(() =>
        combineLatest({
          oldestEventAt: this._ports.events.oldestEventAt$(),
          cursors: this._ports.events.cursors$().pipe(map((cursors) => cursors.length)),
          compactedThrough: this._ports.events.compactedThrough$(),
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

  protected readonly failure = computed(() => {
    const status = this.status();

    return status.state === 'failed' ? status.message : '';
  });

  protected readonly oldestEventAt = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? (status.oldestEventAt?.toLocaleString() ?? null) : null;
  });

  protected readonly compactedThrough = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? (status.compactedThrough?.toLocaleString() ?? null) : null;
  });

  protected readonly cursors = computed(() => {
    const status = this.status();

    return status.state === 'ready' ? status.cursors : 0;
  });

  protected recheck() {
    this._reload.update((count) => count + 1);
  }
}
