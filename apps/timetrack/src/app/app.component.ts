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
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../collectors';
import { injectHostPorts } from '../host';
import { DayReviewComponent } from './day-review';
import { SettingsComponent } from './settings';
import { SourcesComponent } from './sources';
import { TimerControlComponent } from './timer-control.component';
import { injectTrayReadout } from './tray-readout';
import { WindowControlsComponent } from './window-controls.component';

type HostStatus =
  | { state: 'checking' }
  | { state: 'ready'; oldestEventAt: Date | null; cursors: number; compactedThrough: Date | null }
  | { state: 'failed'; message: string };

@Component({
  selector: 'ethlete-root',
  template: `
    <!--
      The titlebar is sticky and opaque: it is the only drag region and the only way to close the
      window, so it has to stay reachable however far the day is scrolled.
    -->
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-et-surface-border bg-et-surface-bg px-3 py-2"
      data-tauri-drag-region="deep"
    >
      <ethlete-timer-control />
      <ethlete-window-controls />
    </div>

    <main class="mx-auto flex max-w-[76rem] flex-col gap-8 p-10">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-h1">Timetrack</h1>
          <p class="text-small text-et-surface-muted">Local-first Jira and Tempo worklogs, rebuilt from evidence.</p>
        </div>

        <button (click)="recheck()" et-button variant="outline" size="sm">Re-check host</button>
      </header>

      <ethlete-day-review />

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

      <ethlete-sources />

      <ethlete-settings />
    </main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CARD_IMPORTS,
    DayReviewComponent,
    DESCRIPTION_LIST_IMPORTS,
    SettingsComponent,
    SourcesComponent,
    SpinnerComponent,
    TimerControlComponent,
    WindowControlsComponent,
  ],
})
export class AppComponent {
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

  constructor() {
    // The tray readout has no view of its own, so nothing else would ever construct it.
    injectTrayReadout();
  }

  protected recheck() {
    this.reload.update((count) => count + 1);
  }
}
