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
import { injectAgentSessionCollector, injectWindowCollector } from '../collectors';
import { injectHostPorts } from '../host';
import { DayReviewComponent } from './day-review';
import { WindowControlsComponent } from './window-controls.component';

type HostStatus =
  | { state: 'checking' }
  | { state: 'ready'; oldestEventAt: Date | null; cursors: number; compactedThrough: Date | null }
  | { state: 'failed'; message: string };

@Component({
  selector: 'ethlete-root',
  template: `
    <main class="mx-auto flex max-w-[76rem] flex-col gap-8 p-10">
      <header class="flex flex-wrap items-start justify-between gap-4" data-tauri-drag-region="deep">
        <div class="flex flex-col gap-1">
          <h1 class="text-h1">Timetrack</h1>
          <p class="text-small text-et-surface-muted">Local-first Jira and Tempo worklogs, rebuilt from evidence.</p>
        </div>

        <div class="flex items-center gap-3">
          <button (click)="recheck()" et-button variant="outline" size="sm">Re-check host</button>

          <ethlete-window-controls />
        </div>
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

      <et-card variant="outlined">
        <h2 class="text-h3">Agent sessions</h2>

        @if (agentSessions.failure(); as failure) {
          <et-banner [description]="failure" type="error" heading="The last collection failed" />
        }

        @if (agentSessions.lastRun(); as run) {
          <dl et-description-list>
            <dt>Last run</dt>
            <dd>{{ run.at.toLocaleTimeString() }}</dd>
            <dt>Samples stored</dt>
            <dd>{{ run.events }}</dd>
            <dt>Unparsed lines</dt>
            <dd>{{ run.unparsedLines }}</dd>
          </dl>
        } @else if (!agentSessions.isCollecting()) {
          <p class="text-small text-et-surface-muted">No run has finished yet.</p>
        }

        @if (agentSessions.isCollecting()) {
          <div class="flex items-center gap-3 text-et-surface-muted">
            <et-spinner />
            <span class="text-base">Reading the session logs…</span>
          </div>
        }
      </et-card>

      <et-card variant="outlined">
        <h2 class="text-h3">Windows and presence</h2>

        @if (windowSourceDetail(); as detail) {
          <et-banner [description]="detail" type="warning" heading="No window source" />
        }

        @if (windows.failure(); as failure) {
          <et-banner [description]="failure" type="error" heading="The last drain failed" />
        }

        <dl et-description-list>
          <dt>Source</dt>
          <dd>{{ windowSourceKind() }}</dd>
          @if (windows.lastRun(); as run) {
            <dt>Last drain</dt>
            <dd>{{ run.at.toLocaleTimeString() }}</dd>
            <dt>Samples stored</dt>
            <dd>{{ run.stored }}</dd>
            <dt>Excluded by a rule</dt>
            <dd>{{ run.excluded }}</dd>
            <dt>Dropped</dt>
            <dd>{{ run.dropped }}</dd>
          }
        </dl>
      </et-card>
    </main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CARD_IMPORTS,
    DayReviewComponent,
    DESCRIPTION_LIST_IMPORTS,
    SpinnerComponent,
    WindowControlsComponent,
  ],
})
export class AppComponent {
  private ports = injectHostPorts();
  protected agentSessions = injectAgentSessionCollector();
  protected windows = injectWindowCollector();

  private reload = signal(0);
  private probe = computed(() => ({
    reload: this.reload(),
    run: this.agentSessions.lastRun(),
    windows: this.windows.lastRun(),
  }));

  protected windowSourceKind = computed(() => this.windows.status()?.kind ?? 'checking…');
  protected windowSourceDetail = computed(() => this.windows.status()?.detail ?? null);

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
