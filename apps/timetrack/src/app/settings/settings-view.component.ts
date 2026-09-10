import { Component, DestroyRef, ViewEncapsulation, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SWITCH_IMPORTS,
  SpinnerComponent,
  TAB_IMPORTS,
} from '@ethlete/components';
import {
  injectAgentSessionCollector,
  injectAgentSpendBackfill,
  injectCodexSessionCollector,
  injectCodexSpendBackfill,
  injectGitCollector,
} from '../../collectors';
import { IssueSelectComponent } from '../jira';
import { injectDayNudge } from '../day-nudge';
import { injectWindowLock } from '../window-lock';
import { AgentSessionResyncComponent } from './agent-session-resync.component';
import { AttributionRulesComponent } from './attribution-rules.component';
import { CallRulesComponent } from './call-rules.component';
import { ExclusionRulesComponent } from './exclusion-rules.component';
import { ExplainComponent } from './explain.component';
import { FavoriteProjectsComponent } from './favorite-projects.component';
import { GoogleConnectionComponent } from './google-connection.component';
import { ProjectLinksComponent } from './project-links.component';
import { RepoProjectsComponent } from './repo-projects.component';
import { ScanRootsComponent } from './scan-roots.component';
import { injectTimetrackSettings } from './settings';
import { TicketSettingsComponent } from './ticket-settings.component';
import { TokenFieldComponent } from './token-field.component';

const DAY_START_WHY = `Work at 01:00 belongs to the evening it came from, not to a two-hour Tuesday that
describes nothing you did. Set the hour your day begins and every screen, total and booking follows it.

Midnight makes a day a calendar date again. The cap is noon, because past that a day would start after
most of it had happened.`;

const FILL_WHY = `A pause shorter than this is logged as the work around it: five minutes without a
keystroke is reading a diff, not a break. Anything longer stays off the timesheet.

Set it to zero to fill nothing. The cap is half an hour, because the day ends a block after 30
unobserved minutes — a longer gap is a stretch nothing watched at all, and claiming it would be inventing
time rather than reading evidence.`;

const NUDGE_WHY = `The reminder arrives as a desktop notification and as a banner in the window. It is only
ever about today, and only while something is still owed.

A development build posts under the terminal, because an unbundled binary has no identity of its own to
post under.`;

const JIRA_WHY = `Issue keys are resolved to ids here, which is what a Tempo worklog is written against.
The token is a Jira API token, and it is kept in the OS keychain — it is written there and only ever asked
about, so there is no path back into this window for the value itself.`;

const TEMPO_WHY = `Worklogs are written here. Tempo issues its own bearer token, separate from Jira's.`;

const GITLAB_WHY = `Your own merge-request activity is read here, which is how reviewing somebody else's
branch becomes time on the issue being reviewed. Collection needs no token: it runs glab, which holds
its own login that this app never sees. Run glab auth login --hostname on the instance named above.

The token below is only for writing - repairing a branch and starting one both open merge requests.
Give it the api scope. Leave it empty if you never use those two.`;

const GITHUB_WHY = `The same reading as GitLab, for github.com. It runs gh, which holds its own login,
so there is no host and no token to give - only this switch.

It is off by default because the feed is account-wide: it reports every public and private repository
you touched, not only the ones you work in. GitHub's feed also stops at 300 events and takes no date
range, so a first run may not reach back a full month. It says so when that happens.`;

const MEETING_WHY = `A meeting whose own title names an issue is logged against it, and one that repeats at
a time Tempo already holds an issue for follows that history. This is the answer for every other meeting.

Leave it unset and such a meeting stays unattributed, which means the review asks about it every day.`;

const LOCK_WHY = `The window starts locked and locks itself again once you have been idle long enough. Your own
account password opens it - the check is the operating system's, through PAM on Linux and the system's own
sheet on macOS, so nothing here holds a secret of its own and there is no second password to remember.

Collection never stops for it. A lock that stopped the collectors would leave a hole in the day, which is
what the pause button is for instead. What is locked is the reading of the day, because the database holds
months of window titles.

A machine that cannot check the account password never locks: there would be no way back in.`;

const LOCK_WAIT_WHY = `How long after you go idle the window locks itself. It is a wait on top of the five
minutes it takes to call you idle at all, so a minute here locks the window about six minutes after your last
keystroke.

Zero locks as soon as you are called idle. Locking the screen locks the window straight away whatever this
says, because walking off is not something to wait out.`;

const SUGGESTIONS_WHY = `For work no branch name, rule or merge request could name an issue for, the review
can ask the agent CLI you already have signed in.

It runs with every tool disabled and sees only what the review shows you before you ask: repository and
branch names, durations, commit subjects, and the issues the rest of the day already reached. Never a
window title, never a file path. A suggestion never syncs on its own.`;

/**
 * Everything the app cannot work out for itself, in five tabs.
 *
 * It is tabs rather than one column because the screen answers five unrelated questions, and reading four
 * of them to find the fifth is what made the old one a wall of text. Every explanation that used to be a
 * paragraph is now behind the glyph next to the thing it explains — see `ethlete-explain`. The text was
 * not the problem; printing all of it at once was.
 */
@Component({
  selector: 'ethlete-settings',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 items-center gap-3 px-6 pt-6">
        <h2 class="text-h3">Settings</h2>

        @if (store.isLoading()) {
          <et-spinner size="sm" />
        }
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pt-4">
          <et-banner [description]="failure" type="error" heading="A setting could not be stored" />
        </div>
      }

      @if (!store.isLoading()) {
        <et-tab-group class="min-h-0 grow px-6 pb-6">
          <et-tab label="The day">
            <div class="flex max-w-3xl flex-col gap-8 py-6">
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-end gap-3">
                  <et-form-field class="w-30" appearance="underline" size="sm">
                    <et-label>Target</et-label>
                    <et-duration-input
                      [value]="store.settings().dayTargetMs"
                      (valueChange)="store.setDayTargetMs($event ?? 0)"
                      durationFormat="hh:mm"
                    />
                  </et-form-field>

                  <et-form-field class="w-30" appearance="underline" size="sm">
                    <et-label>Fill idle up to</et-label>
                    <et-duration-input
                      [value]="store.settings().gapFillMs"
                      (valueChange)="store.setGapFillMs($event ?? 0)"
                      durationFormat="hh:mm"
                    />
                  </et-form-field>

                  <ethlete-explain [text]="FILL_WHY" label="filling idle time" />

                  <et-form-field class="w-30" appearance="underline" size="sm">
                    <et-label>A day starts at</et-label>
                    <et-duration-input
                      [value]="dayStartMs()"
                      (valueChange)="store.setDayStartHour(($event ?? 0) / 3_600_000)"
                      durationFormat="hh:mm"
                    />
                  </et-form-field>

                  <ethlete-explain [text]="DAY_START_WHY" label="when a day starts" />
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-1">
                  <h3 class="text-h4">The end-of-day reminder</h3>
                  <ethlete-explain [text]="NUDGE_WHY" label="the end-of-day reminder" />
                </div>

                <et-choice-field>
                  <et-switch
                    [checked]="store.settings().nudge.enabled"
                    (checkedChange)="store.setNudgeEnabled($event)"
                  />
                  <et-label>Say when today is not finished</et-label>
                </et-choice-field>

                <div class="flex flex-wrap items-end gap-3">
                  <et-form-field class="w-30" appearance="underline" size="sm">
                    <et-label>Remind at</et-label>
                    <et-duration-input
                      [value]="nudgeAtMs()"
                      (valueChange)="store.setNudgeAtMinute(($event ?? 0) / 60_000)"
                      durationFormat="hh:mm"
                    />
                  </et-form-field>

                  <button (click)="sendTestNudge()" et-button variant="outline" size="sm">Send a test reminder</button>
                </div>
              </div>
            </div>
          </et-tab>

          <et-tab label="Jira">
            <div class="flex max-w-3xl flex-col gap-8 py-6">
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-h4">Jira</h3>
                  <et-badge [color]="store.credentials().jira ? 'success' : 'warning'" size="sm">
                    {{ store.credentials().jira ? 'connected' : 'not connected' }}
                  </et-badge>
                  <ethlete-explain [text]="JIRA_WHY" label="the Jira connection" />
                </div>

                <div class="flex flex-wrap gap-3">
                  <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
                    <et-label>Host</et-label>
                    <et-input
                      [value]="store.settings().jira.host"
                      (valueChange)="setHost($event)"
                      placeholder="your-team.atlassian.net"
                      type="url"
                    />
                  </et-form-field>

                  <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
                    <et-label>Account email</et-label>
                    <et-input
                      [value]="store.settings().jira.email"
                      (valueChange)="setEmail($event)"
                      placeholder="you@example.com"
                      type="email"
                    />
                  </et-form-field>
                </div>

                <ethlete-token-field
                  [connected]="store.credentials().jira"
                  (save)="store.saveJiraToken($event)"
                  (forget)="store.forgetJiraToken()"
                  provider="Jira"
                />
              </div>

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-h4">Tempo</h3>
                  <et-badge [color]="store.credentials().tempo ? 'success' : 'warning'" size="sm">
                    {{ store.credentials().tempo ? 'connected' : 'not connected' }}
                  </et-badge>
                  <ethlete-explain [text]="TEMPO_WHY" label="the Tempo connection" />
                </div>

                <ethlete-token-field
                  [connected]="store.credentials().tempo"
                  (save)="store.saveTempoToken($event)"
                  (forget)="store.forgetTempoToken()"
                  provider="Tempo"
                />
              </div>

              <ethlete-ticket-settings
                [settings]="store.settings().ticket"
                (settingsChange)="store.setTicket($event)"
              />

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-1">
                  <h3 class="text-h4">Meetings</h3>
                  <ethlete-explain [text]="MEETING_WHY" label="the meeting issue" />
                </div>

                <div class="flex max-w-100 flex-col gap-1">
                  <span class="text-small text-et-surface-muted">Log a meeting nothing else names against</span>
                  <ethlete-issue-select
                    [value]="store.settings().meetingIssueKey"
                    (valueChange)="store.setMeetingIssueKey($event)"
                    placeholder="Leave it unattributed"
                    ariaLabel="The issue a meeting is logged against"
                  />
                </div>
              </div>
            </div>
          </et-tab>

          <et-tab label="Projects">
            <div class="flex max-w-4xl flex-col gap-8 py-6">
              <ethlete-favorite-projects
                [projects]="store.settings().favoriteProjects"
                (projectsChange)="store.setFavoriteProjects($event)"
              />

              <ethlete-repo-projects
                [repoPaths]="repoPaths()"
                [links]="store.settings().projectLinks"
                [projects]="store.settings().favoriteProjects"
                (add)="store.addProjectLink($event)"
                (remove)="store.removeProjectLink($event)"
              />

              <ethlete-project-links
                [links]="store.settings().projectLinks"
                (add)="store.addProjectLink($event)"
                (remove)="store.removeProjectLink($event)"
              />

              <ethlete-agent-session-resync
                [unlinked]="agent.totals().unlinked"
                [links]="store.settings().projectLinks"
                [busy]="agent.isCollecting()"
                (resync)="resync($event)"
              />

              <ethlete-attribution-rules
                [rules]="store.settings().attributionRules"
                (remove)="store.removeAttributionRule($event)"
              />
            </div>
          </et-tab>

          <et-tab label="Sources">
            <div class="flex max-w-4xl flex-col gap-8 py-6">
              <ethlete-scan-roots
                [roots]="store.settings().gitScanRoots"
                [found]="repoPaths().length"
                (add)="store.addGitScanRoot($event)"
                (remove)="store.removeGitScanRoot($event)"
              />

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-h4">GitLab</h3>
                  <et-badge [color]="store.credentials().gitlab ? 'success' : 'neutral'" size="sm">
                    {{ store.credentials().gitlab ? 'can write' : 'read only' }}
                  </et-badge>
                  <ethlete-explain [text]="GITLAB_WHY" label="the GitLab connection" />
                </div>

                <et-form-field class="min-w-60" appearance="underline" size="sm">
                  <et-label>Instance</et-label>
                  <et-input
                    [value]="store.settings().gitlab.host"
                    (valueChange)="setGitLabHost($event)"
                    placeholder="git.example.com"
                    type="url"
                  />
                </et-form-field>

                <ethlete-token-field
                  [connected]="store.credentials().gitlab"
                  (save)="store.saveGitLabToken($event)"
                  (forget)="store.forgetGitLabToken()"
                  provider="GitLab"
                />
              </div>

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-h4">GitHub</h3>
                  <ethlete-explain [text]="GITHUB_WHY" label="the GitHub connection" />
                </div>

                <et-choice-field>
                  <et-switch
                    [checked]="store.settings().github.enabled"
                    (checkedChange)="store.setGitHubEnabled($event)"
                  />
                  <et-label>Read my pull request activity on github.com</et-label>
                </et-choice-field>
              </div>

              <ethlete-google-connection
                [settings]="store.settings().google"
                [connected]="store.credentials().google"
                [hasClientSecret]="store.hasGoogleClientSecret()"
                (settingsChange)="store.setGoogle($event)"
                (saveClientSecret)="store.saveGoogleClientSecret($event)"
                (forgetClientSecret)="store.forgetGoogleClientSecret()"
              />

              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-h4">Lock the window</h3>
                  @if (lock.isAvailable()) {
                    <et-switch
                      [checked]="store.settings().lockWindow"
                      (checkedChange)="store.setLockWindow($event)"
                      aria-label="Lock the window until the account password is given"
                    />
                  }
                  <ethlete-explain [text]="LOCK_WHY" label="the window lock" />
                </div>

                @if (!lock.isAvailable()) {
                  <p class="text-small text-et-surface-subtle" data-lock-unavailable>
                    This build cannot lock the window. A development build never locks, and a machine with no
                    account-password check never locks either.
                  </p>
                }

                @if (lock.isAvailable() && store.settings().lockWindow) {
                  <div class="flex flex-wrap items-end gap-3">
                    <et-form-field class="w-30" appearance="underline" size="sm">
                      <et-label>Lock after idle</et-label>
                      <et-duration-input
                        [value]="store.settings().lockAfterIdleMs"
                        (valueChange)="store.setLockAfterIdleMs($event ?? 0)"
                        durationFormat="mm:ss"
                      />
                    </et-form-field>

                    <ethlete-explain [text]="LOCK_WAIT_WHY" label="the idle wait" />

                    @if (!lock.isLocked()) {
                      <button (click)="lock.lock()" et-button variant="outline" size="sm">Lock now</button>
                    }
                  </div>
                }
              </div>

              <ethlete-exclusion-rules
                [rules]="store.settings().exclusionRules"
                [keepDefaults]="store.settings().keepDefaultExclusionRules"
                (add)="store.addExclusionRule($event)"
                (remove)="store.removeExclusionRule($event)"
                (keepDefaultsChange)="store.setKeepDefaultExclusionRules($event)"
              />

              <ethlete-call-rules
                [rules]="store.settings().callRules"
                (addCountsAsWork)="store.addCallRule('countsAsWork', $event)"
                (removeCountsAsWork)="store.removeCallRule('countsAsWork', $event)"
                (addNeverCountsAsWork)="store.addCallRule('neverCountsAsWork', $event)"
                (removeNeverCountsAsWork)="store.removeCallRule('neverCountsAsWork', $event)"
              />
            </div>
          </et-tab>

          <et-tab label="Suggestions">
            <div class="flex max-w-3xl flex-col gap-3 py-6">
              <div class="flex items-center gap-2">
                <h3 class="text-h4">Suggestions</h3>
                <et-switch
                  [checked]="store.settings().reasoning.enabled"
                  (checkedChange)="setReasoningEnabled($event)"
                />
                <ethlete-explain [text]="SUGGESTIONS_WHY" label="suggestions" />
              </div>

              <et-form-field class="w-40" appearance="underline" size="sm">
                <et-label>Model</et-label>
                <et-input
                  [value]="store.settings().reasoning.model"
                  (valueChange)="setReasoningModel($event)"
                  placeholder="the CLI decides"
                />
              </et-form-field>
            </div>
          </et-tab>
        </et-tab-group>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    AgentSessionResyncComponent,
    AttributionRulesComponent,
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    DURATION_INPUT_IMPORTS,
    CallRulesComponent,
    ExclusionRulesComponent,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    FavoriteProjectsComponent,
    GoogleConnectionComponent,
    INPUT_IMPORTS,
    IssueSelectComponent,
    ProjectLinksComponent,
    RepoProjectsComponent,
    SWITCH_IMPORTS,
    ScanRootsComponent,
    SpinnerComponent,
    TAB_IMPORTS,
    TicketSettingsComponent,
    TokenFieldComponent,
  ],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class SettingsViewComponent {
  protected store = injectTimetrackSettings();

  public git = injectGitCollector();
  protected agent = injectAgentSessionCollector();
  private agentSpend = injectAgentSpendBackfill();
  private codex = injectCodexSessionCollector();
  private codexSpend = injectCodexSpendBackfill();
  protected lock = injectWindowLock();
  private dayNudge = injectDayNudge();
  private destroyRef = inject(DestroyRef);

  protected readonly DAY_START_WHY = DAY_START_WHY;
  protected readonly FILL_WHY = FILL_WHY;
  protected readonly NUDGE_WHY = NUDGE_WHY;
  protected readonly JIRA_WHY = JIRA_WHY;
  protected readonly TEMPO_WHY = TEMPO_WHY;
  protected readonly GITLAB_WHY = GITLAB_WHY;
  protected readonly GITHUB_WHY = GITHUB_WHY;
  protected readonly MEETING_WHY = MEETING_WHY;
  protected readonly SUGGESTIONS_WHY = SUGGESTIONS_WHY;
  protected readonly LOCK_WHY = LOCK_WHY;
  protected readonly LOCK_WAIT_WHY = LOCK_WAIT_WHY;

  protected repoPaths = computed(() => this.git.discovery()?.repos ?? []);

  /** The reminder is configured as a time of day, and the control it is typed into holds a duration. */
  protected nudgeAtMs = computed(() => this.store.settings().nudge.atMinute * 60_000);

  protected dayStartMs = computed(() => this.store.settings().dayStartHour * 3_600_000);

  /** Every pass over the logs reads the checkout again: one per agent for its sessions, one for their spend. */
  protected resync(paths: readonly string[]) {
    this.agent.resync(paths);
    this.agentSpend.resync(paths);
    this.codex.resync(paths);
    this.codexSpend.resync(paths);
  }

  protected sendTestNudge() {
    this.dayNudge.sendTest$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected setHost(host: string) {
    this.store.setJira({ ...this.store.settings().jira, host });
  }

  protected setEmail(email: string) {
    this.store.setJira({ ...this.store.settings().jira, email });
  }

  protected setGitLabHost(host: string) {
    this.store.setGitLab({ host });
  }

  protected setReasoningEnabled(enabled: boolean) {
    this.store.setReasoning({ ...this.store.settings().reasoning, enabled });
  }

  protected setReasoningModel(model: string) {
    this.store.setReasoning({ ...this.store.settings().reasoning, model: model.trim() });
  }
}
