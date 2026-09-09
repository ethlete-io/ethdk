import { Component, DestroyRef, ViewEncapsulation, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS, BadgeVariant } from '@ethlete/components';
import { formatDurationMs, forgeHostname, forgeLoginFor } from '@ethlete/timetrack';
import { catchError, of, switchMap } from 'rxjs';
import {
  injectAgentSessionCollector,
  injectAgentPromptBackfill,
  injectAgentSpendBackfill,
  injectCalendarCollector,
  injectCallCollector,
  injectCodexSessionCollector,
  injectCodexPromptBackfill,
  injectCodexSpendBackfill,
  injectGitCollector,
  injectGitLabCollector,
  injectIngestCollector,
  injectWindowCollector,
} from '../../collectors';
import { SourceTally, WINDOW_SOURCE_NEEDS_ACCESSIBILITY, injectHostPorts } from '../../host';
import { injectCollectionPause } from '../collection-pause';
import { injectTimetrackSettings } from '../settings/settings';
import {
  formatAgentSessions,
  formatCalendarRead,
  formatCallSource,
  formatGitFailures,
  formatGitLabRead,
  formatGitScan,
  formatIngest,
  formatPerAgent,
  formatLogBackfill,
  formatTally,
  formatWindowSource,
  windowCapabilityLabel,
} from './format';
import { EVIDENCE_SOURCES, EvidenceSource, EvidenceSourceState } from './inventory';
import { UnnamedFocusComponent } from './unnamed-focus.component';

const SPEND_WORDS = { holds: 'spend', stored: 'turns' };

const PROMPT_WORDS = { holds: 'prompts', stored: 'prompts' };

/** What every built source reads as while the hard pause is on, whatever its own state would be. */
const PAUSED_LABEL = 'paused';

const STATE_LABEL: Record<EvidenceSourceState, string> = {
  collecting: 'collecting',
  ready: 'ready',
  configured: 'not set up',
  planned: 'planned',
  'not-running': 'not running',
};

const STATE_COLOR: Record<EvidenceSourceState, string> = {
  collecting: 'success',
  ready: 'brand',
  configured: 'warning',
  planned: 'neutral',
  'not-running': 'warning',
};

/** Outlined for what is not built: a tonal neutral badge is too faint to read as a label at all. */
const STATE_VARIANT: Record<EvidenceSourceState, BadgeVariant> = {
  collecting: 'tonal',
  ready: 'tonal',
  configured: 'tonal',
  planned: 'outline',
  'not-running': 'tonal',
};

/** What the source reads about the focused window on this machine, as the row renders it. */
type SourceCapability = {
  reads: string;
  label: string;
  available: boolean;
  detail: string | null;
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
  /** What the source reads here. Empty for every source but the focused window. */
  capabilities: SourceCapability[];
  /** Something degraded that still leaves the source working. */
  warning: string | null;
  /** Whether the degradation is a permission the user can grant from here. */
  grant: boolean;
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
    <div class="flex w-full max-w-7xl flex-col gap-3 p-6">
      <h2 class="text-h3">Where the day comes from</h2>

      <p class="text-small text-et-surface-muted">
        Everything is read on this machine and stored encrypted. Nothing leaves it except a worklog you accept.
      </p>

      @if (pause.isPaused()) {
        <et-banner
          [description]="'Nothing below is reading anything. Paused ' + pausedFor() + ' ago.'"
          type="warning"
          heading="Collection is paused"
        >
          <button (click)="pause.toggle()" et-button etBannerAction variant="filled" size="sm">
            Resume collection
          </button>
        </et-banner>
      }

      <ethlete-unnamed-focus class="mt-4" />

      <ul class="flex flex-col gap-2">
        @for (row of rows(); track row.source.id) {
          <li
            [attr.data-source]="row.source.id"
            class="flex flex-col gap-1 rounded-md border border-et-surface-border p-3"
          >
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

            @if (row.capabilities.length) {
              <div class="mt-1 flex flex-col gap-1">
                <p class="text-small font-medium">What it reads on this machine</p>

                <ul class="flex flex-col gap-1">
                  @for (capability of row.capabilities; track capability.reads) {
                    <li [attr.data-capability]="capability.reads" class="flex flex-col gap-0.5">
                      <div class="flex flex-wrap items-center gap-2">
                        <et-badge
                          [color]="capability.available ? 'success' : 'neutral'"
                          [variant]="capability.available ? 'tonal' : 'outline'"
                          size="sm"
                        >
                          {{ capability.available ? 'reads' : 'does not read' }}
                        </et-badge>
                        <span class="text-small">{{ capability.label }}</span>
                      </div>

                      @if (capability.detail) {
                        <p class="text-small text-et-surface-subtle">{{ capability.detail }}</p>
                      }
                    </li>
                  }
                </ul>
              </div>
            }

            @if (row.detail) {
              <p class="text-small text-et-surface-subtle">{{ row.detail }}</p>
            }

            @if (row.warning) {
              <et-banner [description]="row.warning" type="warning" heading="Degraded" />
            }

            @if (row.grant) {
              <div>
                <button (click)="grantAccessibility()" et-button variant="outline" size="sm">
                  Allow window titles
                </button>
              </div>
            }

            @if (row.failure) {
              <et-banner [description]="row.failure" type="error" heading="The last run failed" />
            }
          </li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS, UnnamedFocusComponent],
})
export class SourcesViewComponent {
  private destroyRef = inject(DestroyRef);
  private ports = injectHostPorts();
  protected pause = injectCollectionPause();
  private windows = injectWindowCollector();
  private agentSessions = injectAgentSessionCollector();
  private agentSpend = injectAgentSpendBackfill();
  private codexSessions = injectCodexSessionCollector();
  private codexSpend = injectCodexSpendBackfill();
  private agentPrompts = injectAgentPromptBackfill();
  private codexPrompts = injectCodexPromptBackfill();
  private git = injectGitCollector();
  private calendar = injectCalendarCollector();
  private calls = injectCallCollector();
  private gitlab = injectGitLabCollector();
  private ingest = injectIngestCollector();
  private settings = injectTimetrackSettings();

  /** Re-counted whenever a collector reports a run, so the tally moves as evidence arrives. */
  private collected = computed(() => ({
    windows: this.windows.lastRun(),
    agentSessions: this.agentSessions.lastRun(),
    agentSpend: this.agentSpend.lastRun(),
    codexSessions: this.codexSessions.lastRun(),
    codexSpend: this.codexSpend.lastRun(),
    agentPrompts: this.agentPrompts.lastRun(),
    codexPrompts: this.codexPrompts.lastRun(),
    git: this.git.lastRun(),
    calendar: this.calendar.lastRun(),
    calls: this.calls.lastRun(),
    gitlab: this.gitlab.lastRun(),
    ingest: this.ingest.lastRun(),
  }));

  private tallies = toSignal(
    toObservable(this.collected).pipe(
      switchMap(() => this.ports.events.bySource$().pipe(catchError(() => of<SourceTally[]>([])))),
    ),
    { initialValue: [] as SourceTally[] },
  );

  protected pausedFor = computed(() => formatDurationMs(this.pause.pausedForMs()));

  protected rows = computed<SourceRow[]>(() =>
    EVIDENCE_SOURCES.map((source) => {
      const state = this.stateOf(source);
      // A source that is running is the only claim the pause contradicts. One that is not set up, or
      // not built, is still not set up and still not built.
      const paused = this.pause.isPaused() && state === 'collecting';

      return {
        source,
        detail:
          state === 'ready' || state === 'collecting' ? null : (this.loginDetailOf(source) ?? source.detail ?? null),
        label: paused ? PAUSED_LABEL : STATE_LABEL[state],
        color: paused ? 'warning' : STATE_COLOR[state],
        variant: STATE_VARIANT[state],
        stored: this.storedOf({ source, state }),
        run: this.runOf(source),
        capabilities: this.capabilitiesOf(source),
        warning: this.warningOf(source),
        grant: source.collector === 'window' && this.windows.status()?.kind === WINDOW_SOURCE_NEEDS_ACCESSIBILITY,
        failure: this.failureOf(source),
      };
    }),
  );

  protected grantAccessibility() {
    this.windows.requestAccessibility$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /**
   * A source that names a credential is waiting on the keychain, whatever the inventory says it does.
   *
   * A source the host is not watching reads `not-running` rather than `collecting`, because
   * `collecting` is the row that claims something reaches the database. The window and call sources
   * report `none` on a platform they have no implementation for, and the ingest endpoint reports it
   * until it has started, so on Linux the badge would otherwise say a microphone is being watched
   * that nothing is watching.
   */
  private stateOf(source: EvidenceSource): EvidenceSourceState {
    if (source.login) return this.loginDetailOf(source) ? 'configured' : source.state;

    if (source.credential) return this.settings.credentials()[source.credential] ? source.state : 'configured';

    if (source.state === 'collecting' && this.hostStatusKindOf(source) === 'none') return 'not-running';

    return source.state;
  }

  /**
   * Why a shell-out source is not reading yet, or `null` when it is.
   *
   * The three causes are kept apart on purpose. A shell-out has no token in the keychain to go stale,
   * so the two ways it can go quiet — the binary leaving the `PATH`, and the login expiring — would
   * otherwise both read as "not set up", and neither would say which repair to make.
   */
  private loginDetailOf(source: EvidenceSource) {
    if (source.login !== 'glab') return null;

    const { host } = this.settings.settings().gitlab;

    if (!host) return 'Waiting on a GitLab instance in Settings.';

    const auth = this.gitlab.auth();

    if (!auth) return null;
    if (auth.state === 'not-installed') return 'Waiting on `glab`, which is not installed.';
    if (!forgeLoginFor(auth, host)) return `Waiting on \`glab auth login --hostname ${forgeHostname(host)}\`.`;

    return null;
  }

  /** What the host says is watching for this source, or `null` for a source the host has no status for. */
  private hostStatusKindOf(source: EvidenceSource) {
    switch (source.collector) {
      case 'window':
        return this.windows.status()?.kind ?? null;
      case 'call':
        return this.calls.status()?.kind ?? null;
      case 'ingest':
        return this.ingest.status()?.kind ?? null;
      default:
        return null;
    }
  }

  /**
   * A source that has stopped keeps its tally: that it holds events and its newest one has stopped
   * moving is the whole story of a source that was collecting and is not any more.
   */
  private storedOf(row: { source: EvidenceSource; state: EvidenceSourceState }) {
    if (!row.source.eventSource) return null;
    if (row.state !== 'collecting' && row.state !== 'not-running') return null;

    const tally = this.tallies().find((held) => held.source === row.source.eventSource);

    if (row.state === 'not-running' && !tally?.count) return null;

    return formatTally(tally);
  }

  private backfillOf(
    backfill: NonNullable<ReturnType<typeof injectAgentSpendBackfill>>,
    words: { holds: string; stored: string },
  ) {
    return (
      formatLogBackfill({
        lastRun: backfill.lastRun(),
        remaining: backfill.remaining(),
        excluded: backfill.excluded(),
        ...words,
      }) || null
    );
  }

  private runOf(source: EvidenceSource) {
    switch (source.collector) {
      case 'window':
        return formatWindowSource({ status: this.windows.status(), totals: this.windows.totals() }) || null;
      case 'agent-session':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: formatAgentSessions(this.agentSessions.totals()) },
            { agent: 'Codex', line: formatAgentSessions(this.codexSessions.totals()) },
          ]) || null
        );
      case 'agent-usage':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: this.backfillOf(this.agentSpend, SPEND_WORDS) },
            { agent: 'Codex', line: this.backfillOf(this.codexSpend, SPEND_WORDS) },
          ]) || null
        );
      case 'agent-prompt':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: this.backfillOf(this.agentPrompts, PROMPT_WORDS) },
            { agent: 'Codex', line: this.backfillOf(this.codexPrompts, PROMPT_WORDS) },
          ]) || null
        );
      case 'git':
        return formatGitScan({ discovery: this.git.discovery(), scannedAt: this.git.lastRun()?.at ?? null }) || null;
      case 'calendar':
        return (
          formatCalendarRead({
            calendarIds: this.settings.settings().google.calendarIds,
            readAt: this.calendar.lastRun()?.at ?? null,
            excluded: this.calendar.lastRun()?.excluded ?? 0,
          }) || null
        );
      case 'gitlab':
        return (
          formatGitLabRead({
            host: this.settings.settings().gitlab.host,
            readAt: this.gitlab.lastRun()?.at ?? null,
          }) || null
        );
      case 'call':
        return formatCallSource({ status: this.calls.status(), totals: this.calls.totals() }) || null;
      case 'ingest':
        return formatIngest({ status: this.ingest.status(), totals: this.ingest.totals() }) || null;
      default:
        return null;
    }
  }

  /**
   * Only the focused-window row. Presence shares the same collector, and none of these three things is
   * what it reads.
   */
  private capabilitiesOf(source: EvidenceSource): SourceCapability[] {
    if (source.id !== 'window') return [];

    return (this.windows.status()?.capabilities ?? []).map((capability) => ({
      reads: capability.reads,
      label: windowCapabilityLabel(capability.reads),
      available: capability.available,
      detail: capability.detail,
    }));
  }

  private warningOf(source: EvidenceSource) {
    if (source.collector === 'window') return this.windows.status()?.detail ?? null;

    if (source.collector === 'gitlab') return this.gitlab.lastRun()?.failures.join(' ') || null;

    if (source.collector === 'call') return this.calls.status()?.detail ?? null;

    if (source.collector === 'ingest') return this.ingest.status()?.detail ?? null;

    if (source.collector !== 'git') return null;

    const failures = this.git.lastRun()?.failures ?? [];

    return this.git.discovery()?.detail ?? (failures.length ? formatGitFailures(failures) : null);
  }

  private failureOf(source: EvidenceSource) {
    switch (source.collector) {
      case 'window':
        return this.windows.failure();
      case 'agent-session':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: this.agentSessions.failure() },
            { agent: 'Codex', line: this.codexSessions.failure() },
          ]) || null
        );
      case 'agent-usage':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: this.agentSpend.failure() },
            { agent: 'Codex', line: this.codexSpend.failure() },
          ]) || null
        );
      case 'agent-prompt':
        return (
          formatPerAgent([
            { agent: 'Claude Code', line: this.agentPrompts.failure() },
            { agent: 'Codex', line: this.codexPrompts.failure() },
          ]) || null
        );
      case 'git':
        return this.git.failure();
      case 'calendar':
        return this.calendar.failure();
      case 'gitlab':
        return this.gitlab.failure();
      case 'call':
        return this.calls.failure();
      case 'ingest':
        return this.ingest.failure();
      default:
        return null;
    }
  }
}
