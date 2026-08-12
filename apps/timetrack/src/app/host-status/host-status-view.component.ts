import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CARD_IMPORTS,
  DESCRIPTION_LIST_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';

type HostStatus =
  | { state: 'checking' }
  | { state: 'ready'; oldestEventAt: Date | null; cursors: number; compactedThrough: Date | null }
  | { state: 'failed'; message: string };

/** Whether the encrypted store came up, and what it currently holds. */
@Component({
  selector: 'ethlete-host-status',
  template: `
    <et-card variant="outlined">
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
            <dt>Agent-session cursors</dt>
            <dd>{{ cursors() }}</dd>
          </dl>

          <p class="text-small text-et-surface-subtle">The keychain answered and the database decrypted.</p>
        }
      }
    </et-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, CARD_IMPORTS, DESCRIPTION_LIST_IMPORTS, SpinnerComponent],
})
export class HostStatusViewComponent {
  private ports = injectHostPorts();
  private agentSessions = injectAgentSessionCollector();
  private windows = injectWindowCollector();
  private git = injectGitCollector();

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
          cursors: this.ports.events.cursors$().pipe(map((cursors) => cursors.length)),
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

    return status.state === 'ready' ? status.cursors : 0;
  });

  protected recheck() {
    this.reload.update((count) => count + 1);
  }
}
