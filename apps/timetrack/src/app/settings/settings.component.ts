import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  CARD_IMPORTS,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { injectGitCollector } from '../../collectors';
import { ExclusionRulesComponent } from './exclusion-rules.component';
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
    <et-card variant="outlined">
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

            <et-form-field class="w-30" appearance="underline" size="sm">
              <et-label>Target</et-label>
              <et-duration-input
                [value]="store.settings().dayTargetMs"
                (valueChange)="store.setDayTargetMs($event ?? 0)"
                durationFormat="hh:mm"
              />
            </et-form-field>
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
        </div>
      }
    </et-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    CARD_IMPORTS,
    DURATION_INPUT_IMPORTS,
    ExclusionRulesComponent,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    ScanRootsComponent,
    SpinnerComponent,
    TokenFieldComponent,
  ],
})
export class SettingsComponent {
  protected store = injectTimetrackSettings();

  private git = injectGitCollector();

  protected repos = computed(() => this.git.discovery()?.repos.length ?? 0);

  protected setHost(host: string) {
    this.store.setJira({ ...this.store.settings().jira, host });
  }

  protected setEmail(email: string) {
    this.store.setJira({ ...this.store.settings().jira, email });
  }
}
