import { Component, ViewEncapsulation, computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, BANNER_IMPORTS, BadgeVariant, CARD_IMPORTS } from '@ethlete/components';
import { catchError, of, switchMap } from 'rxjs';
import { injectAgentSessionCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { SourceTally, injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { formatAgentSessions, formatGitFailures, formatGitScan, formatTally, formatWindowSource } from './format';
import { EVIDENCE_SOURCES, EvidenceSource, EvidenceSourceState } from './inventory';

const STATE_LABEL: Record<EvidenceSourceState, string> = {
  collecting: 'collecting',
  ready: 'ready',
  configured: 'not set up',
  planned: 'planned',
};

const STATE_COLOR: Record<EvidenceSourceState, string> = {
  collecting: 'success',
  ready: 'brand',
  configured: 'warning',
  planned: 'neutral',
};

/** Outlined for what is not built: a tonal neutral badge is too faint to read as a label at all. */
const STATE_VARIANT: Record<EvidenceSourceState, BadgeVariant> = {
  collecting: 'tonal',
  ready: 'tonal',
  configured: 'tonal',
  planned: 'outline',
};

type SourceRow = {
  source: EvidenceSource;
  /** What the source is still waiting on, or `null` once it is not waiting on anything. */
  detail: string | null;
  label: string;
  color: string;
  variant: BadgeVariant;
  /** What this source has in the store. */
  stored: string | null;
  /** How the collector behind it is doing, where there is more to say than the count. */
  run: string | null;
  /** Something degraded that still leaves the source working. */
  warning: string | null;
  failure: string | null;
};

/**
 * Every source of evidence the tool reads, what each one keeps, and whether it is running.
 *
 * A tool that watches a workday has to be able to answer "what are you reading?" in one place, and
 * the sources that are not built yet are listed alongside the ones that are — the question a person
 * deciding whether to install this asks is about the whole surface, not today's part of it.
 */
@Component({
  selector: 'ethlete-sources',
  template: `
    <et-card variant="outlined">
      <h2 class="text-h3">Where the day comes from</h2>

      <p class="text-small text-et-surface-muted">
        Everything is read on this machine and stored encrypted. Nothing leaves it except a worklog you accept.
      </p>

      <ul class="mt-4 flex flex-col gap-2">
        @for (row of rows(); track row.source.id) {
          <li class="flex flex-col gap-1 rounded-md border border-et-surface-border p-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-base font-medium">{{ row.source.name }}</span>
              <et-badge [color]="row.color" [variant]="row.variant" size="sm">{{ row.label }}</et-badge>
            </div>

            <p class="text-small text-et-surface-muted">{{ row.source.reads }}</p>
            <p class="text-small text-et-surface-subtle">
              <span class="font-medium">Stores:</span> {{ row.source.stores }}
            </p>

            @if (row.stored) {
              <p class="text-small text-et-surface">{{ row.stored }}</p>
            }

            @if (row.run) {
              <p class="text-small text-et-surface-subtle">{{ row.run }}</p>
            }

            @if (row.detail) {
              <p class="text-small text-et-surface-subtle">{{ row.detail }}</p>
            }

            @if (row.warning) {
              <et-banner [description]="row.warning" type="warning" heading="Degraded" />
            }

            @if (row.failure) {
              <et-banner [description]="row.failure" type="error" heading="The last run failed" />
            }
          </li>
        }
      </ul>
    </et-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BANNER_IMPORTS, CARD_IMPORTS],
})
export class SourcesComponent {
  private ports = injectHostPorts();
  private windows = injectWindowCollector();
  private agentSessions = injectAgentSessionCollector();
  private git = injectGitCollector();
  private settings = injectTimetrackSettings();

  /** Re-counted whenever a collector reports a run, so the tally moves as evidence arrives. */
  private collected = computed(() => ({
    windows: this.windows.lastRun(),
    agentSessions: this.agentSessions.lastRun(),
    git: this.git.lastRun(),
  }));

  private tallies = toSignal(
    toObservable(this.collected).pipe(
      switchMap(() => this.ports.events.bySource$().pipe(catchError(() => of<SourceTally[]>([])))),
    ),
    { initialValue: [] as SourceTally[] },
  );

  protected rows = computed<SourceRow[]>(() =>
    EVIDENCE_SOURCES.map((source) => {
      const state = this.stateOf(source);

      return {
        source,
        detail: state === 'ready' ? null : (source.detail ?? null),
        label: STATE_LABEL[state],
        color: STATE_COLOR[state],
        variant: STATE_VARIANT[state],
        stored: this.storedOf(source),
        run: this.runOf(source),
        warning: this.warningOf(source),
        failure: this.failureOf(source),
      };
    }),
  );

  /** A source that names a credential reads its state from the keychain, not from the inventory. */
  private stateOf(source: EvidenceSource): EvidenceSourceState {
    if (!source.credential) return source.state;

    return this.settings.credentials()[source.credential] ? 'ready' : 'configured';
  }

  private storedOf(source: EvidenceSource) {
    if (source.state !== 'collecting' || !source.eventSource) return null;

    return formatTally(this.tallies().find((tally) => tally.source === source.eventSource));
  }

  private runOf(source: EvidenceSource) {
    switch (source.collector) {
      case 'window':
        return formatWindowSource({ status: this.windows.status(), totals: this.windows.totals() }) || null;
      case 'agent-session':
        return formatAgentSessions(this.agentSessions.totals()) || null;
      case 'git':
        return formatGitScan({ discovery: this.git.discovery(), scannedAt: this.git.lastRun()?.at ?? null }) || null;
      default:
        return null;
    }
  }

  private warningOf(source: EvidenceSource) {
    if (source.collector === 'window') return this.windows.status()?.detail ?? null;

    if (source.collector !== 'git') return null;

    const failures = this.git.lastRun()?.failures ?? [];

    return this.git.discovery()?.detail ?? (failures.length ? formatGitFailures(failures) : null);
  }

  private failureOf(source: EvidenceSource) {
    switch (source.collector) {
      case 'window':
        return this.windows.failure();
      case 'agent-session':
        return this.agentSessions.failure();
      case 'git':
        return this.git.failure();
      default:
        return null;
    }
  }
}
