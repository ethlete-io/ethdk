import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS, BadgeVariant } from '@ethlete/components';
import {
  EditorCli,
  EditorInstall,
  EditorReporter,
  EditorReporterState,
  GITHUB_HOST,
  editorInstallCommand,
  formatDurationMs,
  forgeHostname,
  forgeLoginFor,
  installEditorReporter$,
  probeEditorReporters$,
} from '@ethlete/timetrack';
import { catchError, of, switchMap, tap } from 'rxjs';
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
  injectGitHubCollector,
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
  formatForgeRead,
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

/** Only the two states an editor row can be in once the one that hides it is filtered out. */
type ShownReporterState = Exclude<EditorReporterState, 'not-on-path'>;

const REPORTER_LABEL: Record<ShownReporterState, string> = {
  installed: 'installed',
  'not-installed': 'not installed',
  unreadable: 'could not be read',
};

/**
 * An editor without the reporter is neutral rather than a warning: most people run one editor, and
 * three rows shouting about the two they never opened would bury the one that matters.
 */
const REPORTER_COLOR: Record<ShownReporterState, string> = {
  installed: 'success',
  'not-installed': 'neutral',
  unreadable: 'warning',
};

const REPORTER_VARIANT: Record<ShownReporterState, BadgeVariant> = {
  installed: 'tonal',
  'not-installed': 'outline',
  unreadable: 'tonal',
};

/** One editor found on this machine, and what to do about it. */
type ReporterRow = {
  cli: EditorCli;
  name: string;
  label: string;
  color: string;
  variant: BadgeVariant;
  detail: string | null;
  /** What to run to put the reporter in from a checkout, and `null` unless this build ships no `.vsix`. */
  command: string | null;
  /** Whether the button that installs the shipped `.vsix` into this editor is offered. */
  install: boolean;
  installing: boolean;
  /** Whether any editor is being installed into, which is what takes every button out of reach. */
  busy: boolean;
  /** Whether this editor was installed into in this visit, so the row can say the reporter is live. */
  installedNow: boolean;
  /** Why the last install into this editor failed, and `null` when none did. */
  failure: string | null;
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
  /** The editors found on this machine, `null` for every other source and until they are asked. */
  reporters: ReporterRow[] | null;
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

            @if (row.reporters) {
              <div class="mt-1 flex flex-col gap-1">
                <p class="text-small font-medium">Editors on this machine</p>

                @if (row.reporters.length) {
                  <ul class="flex flex-col gap-1">
                    @for (reporter of row.reporters; track reporter.cli) {
                      <li [attr.data-editor]="reporter.cli" class="flex flex-col gap-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                          <et-badge [color]="reporter.color" [variant]="reporter.variant" size="sm">
                            {{ reporter.label }}
                          </et-badge>
                          <span class="text-small">{{ reporter.name }}</span>

                          @if (reporter.install) {
                            <button
                              [disabled]="reporter.busy"
                              (click)="installReporter(reporter.cli)"
                              et-button
                              variant="outline"
                              size="sm"
                            >
                              {{ reporter.installing ? 'Installing…' : 'Install' }}
                            </button>
                          }
                        </div>

                        @if (reporter.detail) {
                          <p class="text-small text-et-surface-subtle">{{ reporter.detail }}</p>
                        }

                        @if (reporter.installedNow) {
                          <p class="text-small text-et-surface-subtle">
                            {{ reporter.name }} loads the reporter by itself. If no heartbeat arrives, restart it.
                          </p>
                        }

                        @if (reporter.failure) {
                          <p class="text-small text-et-error">{{ reporter.failure }}</p>
                        }

                        @if (reporter.command) {
                          <code class="text-small text-et-surface-subtle">{{ reporter.command }}</code>
                        }
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-small text-et-surface-subtle">No editor this app has a reporter for is on the PATH.</p>
                }
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
  private github = injectGitHubCollector();
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
    github: this.github.lastRun(),
    ingest: this.ingest.lastRun(),
  }));

  private tallies = toSignal(
    toObservable(this.collected).pipe(
      switchMap(() => this.ports.events.bySource$().pipe(catchError(() => of<SourceTally[]>([])))),
    ),
    { initialValue: [] as SourceTally[] },
  );

  /**
   * Asked when this screen is created, and again after an install. Nothing else changes an editor
   * while it is open, so a run of five processes on a timer would buy nothing.
   */
  private probed = signal(0);

  private editors = toSignal(
    toObservable(this.probed).pipe(
      switchMap(() =>
        probeEditorReporters$({ runner: this.ports.processes }).pipe(catchError(() => of<EditorReporter[]>([]))),
      ),
    ),
    { initialValue: null },
  );

  /** The reporter this build ships, and `null` when it ships none. */
  private vsix = toSignal(this.ports.reporter.vsix$().pipe(catchError(() => of(null))), { initialValue: null });

  /** The editor an install is running against, and `null` while none is. Only one runs at a time. */
  public installing = signal<EditorCli | null>(null);

  /** The editors installed into in this visit, which hold the reporter but have not loaded it yet. */
  private installed = signal<readonly EditorCli[]>([]);

  private installFailures = signal<Partial<Record<EditorCli, string>>>({});

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
        reporters: this.reportersOf(source),
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
   * Puts the shipped reporter into one editor, then asks every editor again.
   *
   * The re-probe is what flips the badge, so the install and the row it changes cannot disagree. The
   * button renders only for an editor that reports no reporter, so nothing older is loaded to shadow
   * the new build, and the editor activates it without a restart.
   */
  protected installReporter(cli: EditorCli) {
    const vsix = this.vsix();

    if (!vsix || this.installing()) return;

    this.installing.set(cli);
    this.installFailures.update((failures) => ({ ...failures, [cli]: undefined }));

    installEditorReporter$({ runner: this.ports.processes, cli, vsix })
      .pipe(
        tap((result) => this.recordInstall({ cli, result })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private recordInstall(options: { cli: EditorCli; result: EditorInstall }) {
    const { cli, result } = options;

    this.installing.set(null);

    if (result.ok) {
      this.installed.update((held) => (held.includes(cli) ? held : [...held, cli]));
    } else {
      this.installFailures.update((failures) => ({ ...failures, [cli]: result.detail }));
    }

    this.probed.update((count) => count + 1);
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
    if (!source.login) return null;

    const gate =
      source.login === 'glab'
        ? { auth: this.gitlab.auth(), host: this.settings.settings().gitlab.host, waiting: 'a GitLab instance' }
        : {
            auth: this.github.auth(),
            host: this.settings.settings().github.enabled ? GITHUB_HOST : '',
            waiting: 'the GitHub switch',
          };

    if (!gate.host) return `Waiting on ${gate.waiting} in Settings.`;
    if (!gate.auth) return null;
    if (gate.auth.state === 'not-installed') return `Waiting on \`${source.login}\`, which is not installed.`;
    if (!forgeLoginFor(gate.auth, gate.host)) {
      return `Waiting on \`${source.login} auth login --hostname ${forgeHostname(gate.host)}\`.`;
    }

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
          formatForgeRead({
            reading: this.settings.settings().gitlab.host || null,
            readAt: this.gitlab.lastRun()?.at ?? null,
          }) || null
        );
      case 'github':
        return (
          formatForgeRead({
            reading: this.settings.settings().github.enabled ? GITHUB_HOST : null,
            readAt: this.github.lastRun()?.at ?? null,
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
   * Only the editor row. An editor the `PATH` does not hold is left out rather than shown as missing
   * the reporter: it is not on this machine, so there is nothing here to repair.
   */
  private reportersOf(source: EvidenceSource): ReporterRow[] | null {
    if (source.id !== 'vscode') return null;

    const found = this.editors();

    if (!found) return null;

    const vsix = this.vsix();
    const installing = this.installing();
    const failures = this.installFailures();

    return found
      .filter((editor) => editor.state !== 'not-on-path')
      .map((editor): ReporterRow => {
        const state = editor.state as ShownReporterState;
        const missing = state === 'not-installed';

        return {
          cli: editor.cli,
          name: editor.name,
          label: REPORTER_LABEL[state],
          color: REPORTER_COLOR[state],
          variant: REPORTER_VARIANT[state],
          detail: editor.detail,
          command: missing && !vsix ? editorInstallCommand(editor.cli) : null,
          install: missing && !!vsix,
          installing: installing === editor.cli,
          busy: installing !== null,
          installedNow: this.installed().includes(editor.cli),
          failure: failures[editor.cli] ?? null,
        };
      });
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

    if (source.collector === 'github') return this.github.lastRun()?.failures.join(' ') || null;

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
      case 'github':
        return this.github.failure();
      case 'call':
        return this.calls.failure();
      case 'ingest':
        return this.ingest.failure();
      default:
        return null;
    }
  }
}
