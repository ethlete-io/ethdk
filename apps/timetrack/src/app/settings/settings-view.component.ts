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
import { injectGitCollector } from '../../collectors';
import { IssueSelectComponent } from '../jira';
import { injectDayNudge } from '../day-nudge';
import { AttributionRulesComponent } from './attribution-rules.component';
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

const FILL_WHY = `A pause shorter than this is logged as the work around it: five minutes without a
keystroke is reading a diff, not a break. Anything longer stays off the timesheet.

Set it to zero to fill nothing. The cap is half an hour, because the sessionizer ends a block after 30
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
branch becomes time on the issue being reviewed. The token is a personal access token with the read_api
scope.`;

const MEETING_WHY = `A meeting whose own title names an issue is logged against it, and one that repeats at
a time Tempo already holds an issue for follows that history. This is the answer for every other meeting.

Leave it unset and such a meeting stays unattributed, which means the review asks about it every day.`;

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
                  <et-badge [color]="store.credentials().gitlab ? 'success' : 'warning'" size="sm">
                    {{ store.credentials().gitlab ? 'connected' : 'not connected' }}
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

              <ethlete-google-connection
                [settings]="store.settings().google"
                [connected]="store.credentials().google"
                [hasClientSecret]="store.hasGoogleClientSecret()"
                (settingsChange)="store.setGoogle($event)"
                (saveClientSecret)="store.saveGoogleClientSecret($event)"
                (forgetClientSecret)="store.forgetGoogleClientSecret()"
              />

              <ethlete-exclusion-rules
                [rules]="store.settings().exclusionRules"
                [keepDefaults]="store.settings().keepDefaultExclusionRules"
                (add)="store.addExclusionRule($event)"
                (remove)="store.removeExclusionRule($event)"
                (keepDefaultsChange)="store.setKeepDefaultExclusionRules($event)"
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
    AttributionRulesComponent,
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    DURATION_INPUT_IMPORTS,
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
  private dayNudge = injectDayNudge();
  private destroyRef = inject(DestroyRef);

  protected readonly FILL_WHY = FILL_WHY;
  protected readonly NUDGE_WHY = NUDGE_WHY;
  protected readonly JIRA_WHY = JIRA_WHY;
  protected readonly TEMPO_WHY = TEMPO_WHY;
  protected readonly GITLAB_WHY = GITLAB_WHY;
  protected readonly MEETING_WHY = MEETING_WHY;
  protected readonly SUGGESTIONS_WHY = SUGGESTIONS_WHY;

  protected repoPaths = computed(() => this.git.discovery()?.repos ?? []);

  /** The reminder is configured as a time of day, and the control it is typed into holds a duration. */
  protected nudgeAtMs = computed(() => this.store.settings().nudge.atMinute * 60_000);

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
