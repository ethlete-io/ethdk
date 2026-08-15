import { Component, DestroyRef, ViewEncapsulation, computed, inject, linkedSignal } from '@angular/core';
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
} from '@ethlete/components';
import { injectGitCollector } from '../../collectors';
import { injectDayNudge } from '../day-nudge';
import { AttributionRulesComponent } from './attribution-rules.component';
import { ExclusionRulesComponent } from './exclusion-rules.component';
import { GoogleConnectionComponent } from './google-connection.component';
import { ScanRootsComponent } from './scan-roots.component';
import { injectTimetrackSettings } from './settings';
import { TokenFieldComponent } from './token-field.component';

/**
 * Everything the app cannot work out for itself: the day's target, the two API credentials, what is
 * never collected and where repositories are looked for.
 *
 * The credentials are split the way they are stored — the instance and the account are in the settings
 * document, the token is in the keychain, and only the token's presence comes back.
 */
@Component({
  selector: 'ethlete-settings',
  template: `
    <div class="flex w-full max-w-7xl flex-col gap-3 p-6">
      <h2 class="text-h3">Settings</h2>

      @if (store.failure(); as failure) {
        <et-banner [description]="failure" type="error" heading="A setting could not be stored" />
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Reading the settings…</span>
        </div>
      } @else {
        <div class="mt-4 flex flex-col gap-8">
          <div class="flex flex-col gap-3">
            <h3 class="text-h4">The day</h3>

            <div class="flex flex-wrap gap-3">
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
            </div>

            <p class="text-small text-et-surface-muted">
              A pause shorter than this is logged as the work around it: five minutes without a keystroke is reading a
              diff, not a break. Anything longer stays off the timesheet. Set it to zero to fill nothing.
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <h3 class="text-h4">The end-of-day reminder</h3>

            <et-choice-field>
              <et-switch [checked]="store.settings().nudge.enabled" (checkedChange)="store.setNudgeEnabled($event)" />
              <et-label>Say when today is not finished</et-label>
              <et-hint>Only about today, and only while something is still owed.</et-hint>
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

            <p class="text-small text-et-surface-muted">
              The reminder arrives as a desktop notification and as a banner in the window. A development build posts
              under the terminal, because an unbundled binary has no identity of its own to post under.
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <h3 class="text-h4">Jira</h3>

              <et-badge [color]="store.credentials().jira ? 'success' : 'warning'" size="sm">
                {{ store.credentials().jira ? 'connected' : 'not connected' }}
              </et-badge>
            </div>

            <p class="text-small text-et-surface-muted">
              Issue keys are resolved to ids here, which is what a Tempo worklog is written against. The token is a Jira
              API token, and it is kept in the OS keychain.
            </p>

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

            <et-form-field class="min-w-60" appearance="underline" size="sm">
              <et-label>Project keys</et-label>
              <et-input [(value)]="typedPrefixes" (blur)="commitPrefixes()" placeholder="FIP, ETH" />
              <et-hint>
                Which keys a branch name may carry. Without them anything shaped like a key counts, so a branch called
                chore/angular-22 is read as issue ANGULAR-22.
              </et-hint>
            </et-form-field>

            <ethlete-token-field
              [connected]="store.credentials().jira"
              (save)="store.saveJiraToken($event)"
              (forget)="store.forgetJiraToken()"
              provider="Jira"
            />
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <h3 class="text-h4">Tempo</h3>

              <et-badge [color]="store.credentials().tempo ? 'success' : 'warning'" size="sm">
                {{ store.credentials().tempo ? 'connected' : 'not connected' }}
              </et-badge>
            </div>

            <p class="text-small text-et-surface-muted">
              Worklogs are written here. Tempo issues its own bearer token, separate from Jira's.
            </p>

            <ethlete-token-field
              [connected]="store.credentials().tempo"
              (save)="store.saveTempoToken($event)"
              (forget)="store.forgetTempoToken()"
              provider="Tempo"
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

          <ethlete-scan-roots
            [roots]="store.settings().gitScanRoots"
            [found]="repos()"
            (add)="store.addGitScanRoot($event)"
            (remove)="store.removeGitScanRoot($event)"
          />

          <ethlete-attribution-rules
            [rules]="store.settings().attributionRules"
            (remove)="store.removeAttributionRule($event)"
          />
        </div>
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
    FORM_FIELD_IMPORTS,
    GoogleConnectionComponent,
    INPUT_IMPORTS,
    ScanRootsComponent,
    SWITCH_IMPORTS,
    SpinnerComponent,
    TokenFieldComponent,
  ],
})
export class SettingsViewComponent {
  protected store = injectTimetrackSettings();

  private git = injectGitCollector();
  private dayNudge = injectDayNudge();
  private destroyRef = inject(DestroyRef);

  protected repos = computed(() => this.git.discovery()?.repos.length ?? 0);

  /** The reminder is configured as a time of day, and the control it is typed into holds a duration. */
  protected nudgeAtMs = computed(() => this.store.settings().nudge.atMinute * 60_000);

  /**
   * Held as the text the user typed until they leave the field. Normalising each keystroke back into the
   * document would eat the separator the moment it is typed.
   */
  protected typedPrefixes = linkedSignal(() => this.store.settings().issueKeyPrefixes.join(', '));

  protected sendTestNudge() {
    this.dayNudge.sendTest$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected commitPrefixes() {
    this.store.setIssueKeyPrefixes(this.typedPrefixes());
  }

  protected setHost(host: string) {
    this.store.setJira({ ...this.store.settings().jira, host });
  }

  protected setEmail(email: string) {
    this.store.setJira({ ...this.store.settings().jira, email });
  }
}
