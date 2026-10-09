import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SELECT_IMPORTS,
} from '@ethlete/components';
import { callNamingKey, carriesCredentialsSafely, findStandIn, normalizeJiraHost } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';
import { TicketSettingsComponent } from './ticket-settings.component';
import { TokenFieldComponent } from './token-field.component';
import { injectTimetrackSettings } from './settings';

const EPIC_CHILD_WHY = `A checkout on a branch no issue key names can still be named from another checkout
on the same branch name: its issue is read, and the one open child of that issue's parent nobody else
books names the work. This is how many children of that parent are read. A parent that holds more than
this is left alone rather than guessed at, so raise it for a team whose epics run long.`;

const JIRA_WHY = `Issue keys are resolved to ids here, which is what a Tempo worklog is written against.
The token is a Jira API token, and it is kept in the OS keychain — it is written there and only ever asked
about, so there is no path back into this window for the value itself.`;

const TEMPO_WHY = `Worklogs are written here. Tempo issues its own bearer token, separate from Jira's.`;

const INSECURE_HOST = `Every call to it carries your token, and a plain http request puts that token and
everything it answers on the wire for anyone on the network to read. No call is made to this host until
it is https.`;

const MEETING_WHY = `A meeting whose own title names an issue is logged against it, and one that repeats at
a time Tempo already holds an issue for follows that history. This is the answer for every other meeting.

Leave it unset and such a meeting stays unattributed, which means the review asks about it every day.`;

const CALL_NAMING_WHY = `A call the calendar never held has no series to be remembered under, so your answer is
remembered against the call itself: the application, the weekday, roughly how long it ran and what ran before it.

That last one is what names a call with no fixed start - one that begins when the meeting before it ends.`;

const EPIC_CHILD_LADDER = [25, 50, 100, 200, 500];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'ethlete-settings-jira-view',
  template: `
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

        @if (jiraHostInsecure()) {
          <et-banner
            [description]="INSECURE_HOST"
            type="error"
            heading="This host is not https"
            data-jira-insecure-host
          />
        }

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

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">How far an epic is read</h3>
          <ethlete-explain [text]="EPIC_CHILD_WHY" label="reading an epic" />
        </div>

        <et-form-field class="w-48" appearance="underline" size="sm">
          <et-label>Children read</et-label>
          <et-select [value]="epicChildLimit()" (valueChange)="store.setEpicChildLimit(+$event)">
            @for (option of epicChildOptions(); track option.value) {
              <et-select-option [value]="option.value" [label]="option.label" />
            }
          </et-select>
        </et-form-field>
      </div>

      <ethlete-ticket-settings [settings]="store.settings().ticket" (settingsChange)="store.setTicket($event)" />

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">Meetings</h3>
          <ethlete-explain [text]="MEETING_WHY" label="the meeting issue" />
        </div>

        @if (store.settings().meetingNamings.length) {
          <ul class="flex max-w-150 list-none flex-col gap-1">
            @for (naming of store.settings().meetingNamings; track naming.seriesKey) {
              <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small" data-meeting-naming>
                <span class="min-w-40 grow truncate">{{ naming.title }}</span>
                <span class="text-mono text-et-surface-muted">{{ naming.issueKey }}</span>
                <button (click)="store.forgetMeetingNaming(naming.seriesKey)" et-button variant="transparent" size="sm">
                  Forget
                </button>
              </li>
            }
          </ul>
        } @else {
          <span class="text-small text-et-surface-subtle">
            Nothing yet. Name a meeting on a day and every later one of that series is named from your answer.
          </span>
        }
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">Calls</h3>
          <ethlete-explain [text]="CALL_NAMING_WHY" label="a remembered call" />
        </div>

        @if (store.settings().callNamings.length) {
          <ul class="flex max-w-150 list-none flex-col gap-1">
            @for (naming of callNamings(); track naming.key) {
              <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small" data-call-naming>
                <span class="min-w-40 grow truncate">{{ naming.label }}</span>
                <span class="text-et-surface-muted">{{ naming.when }}</span>
                <span class="text-mono text-et-surface-muted">{{ naming.named }}</span>
                <button (click)="store.forgetCallNaming(naming.key)" et-button variant="transparent" size="sm">
                  Forget
                </button>
              </li>
            }
          </ul>
        } @else {
          <span class="text-small text-et-surface-subtle">
            Nothing yet. Name a call the calendar never held and the next one like it is named from your answer.
          </span>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    SELECT_IMPORTS,
    TicketSettingsComponent,
    TokenFieldComponent,
  ],
})
export class SettingsJiraViewComponent {
  protected store = injectTimetrackSettings();

  protected readonly EPIC_CHILD_WHY = EPIC_CHILD_WHY;
  protected readonly JIRA_WHY = JIRA_WHY;
  protected readonly TEMPO_WHY = TEMPO_WHY;
  protected readonly INSECURE_HOST = INSECURE_HOST;
  protected readonly MEETING_WHY = MEETING_WHY;
  protected readonly CALL_NAMING_WHY = CALL_NAMING_WHY;

  /** The call namings with the key the Forget button needs and a line saying when the call runs. */
  protected callNamings = computed(() => {
    const standIns = this.store.settings().standIns;

    return this.store.settings().callNamings.map((naming) => ({
      key: callNamingKey(naming),
      label: naming.label,
      named:
        naming.target.kind === 'issue'
          ? naming.target.issueKey
          : (findStandIn({ id: naming.target.standInId, standIns })?.name ?? 'a deleted stand-in'),
      when: `${WEEKDAYS[naming.weekday] ?? ''} ${naming.durationBand} min`.trim(),
    }));
  });

  /**
   * Whether the configured host would put its token on the wire in the clear.
   *
   * The provider clients refuse such a host, and the transport refuses it again. Saying so under the
   * field is the only place the user can act on it, because a request is what raises it otherwise.
   */
  protected jiraHostInsecure = computed(() => {
    const { host } = this.store.settings().jira;

    return host.length > 0 && !carriesCredentialsSafely(normalizeJiraHost(host));
  });

  /** The select answers in strings, and the setting is a count. */
  protected epicChildLimit = computed(() => `${this.store.settings().epicChildLimit}`);

  protected epicChildOptions = computed(() =>
    [...new Set([...EPIC_CHILD_LADDER, this.store.settings().epicChildLimit])]
      .sort((left, right) => left - right)
      .map((limit) => ({ value: `${limit}`, label: `${limit} children` })),
  );

  protected setHost(host: string) {
    this.store.setJira({ ...this.store.settings().jira, host });
  }

  protected setEmail(email: string) {
    this.store.setJira({ ...this.store.settings().jira, email });
  }
}
