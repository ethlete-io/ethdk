import { Component, ViewEncapsulation, computed, effect, input, output } from '@angular/core';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CHECKBOX_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { TimetrackGoogleSettings } from '@ethlete/timetrack';
import { injectGoogleAccount } from '../google';
import { TokenFieldComponent } from './token-field.component';

/**
 * The Google account, from the client the user registered to the calendars they count as work.
 *
 * Every user brings their own OAuth client, which is why the id and the secret are fields rather than
 * something the app ships: an app-wide client would put every user's calendar behind one quota and one
 * consent screen, and Google's verification asks for a privacy policy this app has no use for.
 */
@Component({
  selector: 'ethlete-google-connection',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <h3 class="text-h4">Google Calendar</h3>

        <et-badge [color]="connected() ? 'success' : 'warning'" size="sm">
          {{ connected() ? 'connected' : 'not connected' }}
        </et-badge>

        @if (account.busy()) {
          <et-spinner size="sm" />
        }
      </div>

      <p class="text-small text-et-surface-muted">
        Meetings say which part of the day was spent with other people, and a Meet window title is matched to the event
        it belongs to. Register an OAuth client of type <em>Desktop app</em> in your own Google Cloud project, then add
        yourself as a test user — Google shows an unverified-app warning until you do.
      </p>

      @if (account.failure(); as failure) {
        <et-banner [description]="failure" type="error" heading="The account could not be connected" />
      }

      <et-form-field class="min-w-60" appearance="underline" size="sm">
        <et-label>Client id</et-label>
        <et-input
          [value]="settings().clientId"
          (valueChange)="setClientId($event)"
          placeholder="000000000000-abc.apps.googleusercontent.com"
        />
      </et-form-field>

      <ethlete-token-field
        [connected]="hasClientSecret()"
        (save)="saveClientSecret.emit($event)"
        (forget)="forgetClientSecret.emit()"
        provider="Google client secret"
        forgetLabel="Remove"
      />

      <div class="flex flex-wrap items-center gap-3">
        <button [disabled]="account.busy()" (click)="account.connect()" et-button variant="filled" size="sm">
          {{ connected() ? 'Connect again' : 'Connect' }}
        </button>

        @if (connected()) {
          <button [disabled]="account.busy()" (click)="account.disconnect()" et-button variant="transparent" size="sm">
            Disconnect
          </button>
        }
      </div>

      @if (connected()) {
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <h4 class="text-base">Calendars counted as work</h4>

            <button
              [disabled]="account.busy()"
              (click)="account.loadCalendars()"
              et-button
              variant="transparent"
              size="sm"
            >
              Refresh
            </button>
          </div>

          @for (calendar of account.calendars() ?? []; track calendar.id) {
            <et-choice-field>
              <et-checkbox [checked]="picked().has(calendar.id)" (checkedChange)="toggle(calendar.id, $event)" />
              <et-label>{{ calendar.name }}</et-label>
            </et-choice-field>
          } @empty {
            <p class="text-small text-et-surface-subtle">
              {{ account.calendars() ? 'This account has no calendars.' : 'Reading the calendars…' }}
            </p>
          }

          <p class="text-small text-et-surface-subtle">
            Nothing is read until a calendar is picked. A personal calendar lives on the same account.
          </p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CHECKBOX_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    SpinnerComponent,
    TokenFieldComponent,
  ],
})
export class GoogleConnectionComponent {
  protected account = injectGoogleAccount();

  public settings = input.required<TimetrackGoogleSettings>();
  public connected = input(false);
  public hasClientSecret = input(false);

  public settingsChange = output<TimetrackGoogleSettings>();
  public saveClientSecret = output<string>();
  public forgetClientSecret = output<void>();

  protected picked = computed(() => new Set(this.settings().calendarIds));

  constructor() {
    effect(() => {
      if (this.connected() && !this.account.calendars() && !this.account.busy()) this.account.loadCalendars();
    });
  }

  protected setClientId(clientId: string) {
    this.settingsChange.emit({ ...this.settings(), clientId });
  }

  protected toggle(id: string, picked: boolean) {
    const ids = this.settings().calendarIds.filter((existing) => existing !== id);

    this.settingsChange.emit({ ...this.settings(), calendarIds: picked ? [...ids, id] : ids });
  }
}
