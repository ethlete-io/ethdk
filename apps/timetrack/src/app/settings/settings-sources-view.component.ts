import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SWITCH_IMPORTS,
} from '@ethlete/components';
import { forgeHostname, forgeLoginFor, isForgeHostname } from '@ethlete/timetrack';
import { injectGitCollector, injectGitLabCollector } from '../../collectors';
import { injectWindowLock } from '../window-lock';
import { CallRulesComponent } from './call-rules.component';
import { ExclusionRulesComponent } from './exclusion-rules.component';
import { ExplainComponent } from './explain.component';
import { GoogleConnectionComponent } from './google-connection.component';
import { PairedMachinesComponent } from './paired-machines.component';
import { ScanRootsComponent } from './scan-roots.component';
import { TranscriptionPanelComponent } from './transcription-panel.component';
import { injectTimetrackSettings } from './settings';

const GITLAB_WHY = `Your own merge-request activity is read here, which is how reviewing somebody else's
branch becomes time on the issue being reviewed. Everything goes through glab, which holds its own login
that this app never sees, so there is no token to give here.

Writes use glab too: repairing a branch and starting one both open or change merge requests. Run
glab auth login --hostname <instance> once, and give the token it asks for the api scope.`;

const NOT_A_HOSTNAME = `Name the instance by its hostname, like git.example.com. An email address or a git
remote names an account, and no GitLab answers at it.`;

const GITHUB_WHY = `The same reading as GitLab, for github.com. It runs gh, which holds its own login,
so there is no host and no token to give - only this switch.

It is off by default because the feed is account-wide: it reports every public and private repository
you touched, not only the ones you work in. GitHub's feed also stops at 300 events and takes no date
range, so a first run may not reach back a full month. It says so when that happens.`;

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

@Component({
  selector: 'ethlete-settings-sources-view',
  template: `
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
          <et-badge [color]="glabCanWrite() ? 'success' : 'neutral'" size="sm" data-gitlab-status>
            {{ glabCanWrite() ? 'can write' : 'no glab login' }}
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

        @if (gitlabHostNotHostname()) {
          <et-banner
            [description]="NOT_A_HOSTNAME"
            type="error"
            heading="This is not an instance"
            data-gitlab-not-hostname
          />
        }

        @if (glabOffers().length) {
          <div class="flex flex-wrap items-center gap-2" data-glab-offers>
            <span class="text-small text-et-surface-muted">glab is logged in to:</span>

            @for (host of glabOffers(); track host) {
              <button (click)="setGitLabHost(host)" et-button variant="outline" size="sm">{{ host }}</button>
            }
          </div>
        }

        <p class="text-small text-et-surface-muted">
          Reading and writing both use glab. Run
          <code>glab auth login --hostname {{ gitlabHostname() || 'git.example.com' }}</code>
          once.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <h3 class="text-h4">GitHub</h3>
          <ethlete-explain [text]="GITHUB_WHY" label="the GitHub connection" />
        </div>

        <et-choice-field>
          <et-switch [checked]="store.settings().github.enabled" (checkedChange)="store.setGitHubEnabled($event)" />
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

      <ethlete-paired-machines />

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
            This build cannot lock the window. A development build never locks, and a machine with no account-password
            check never locks either.
          </p>
        }

        @if (lock.isAvailable() && store.settings().lockWindow) {
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex items-end">
              <et-form-field class="w-30" appearance="underline" size="sm">
                <et-label>Lock after idle</et-label>
                <et-duration-input
                  [value]="store.settings().lockAfterIdleMs"
                  (valueChange)="store.setLockAfterIdleMs($event ?? 0)"
                  durationFormat="mm:ss"
                />
              </et-form-field>
              <ethlete-explain [text]="LOCK_WAIT_WHY" label="the idle wait" />
            </div>

            @if (!lock.isLocked()) {
              <button (click)="lock.lock()" et-button variant="outline" size="sm">Lock now</button>
            }
          </div>
        }
      </div>

      <ethlete-transcription-panel />

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
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    CHOICE_FIELD_IMPORTS,
    CallRulesComponent,
    DURATION_INPUT_IMPORTS,
    ExclusionRulesComponent,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    GoogleConnectionComponent,
    INPUT_IMPORTS,
    PairedMachinesComponent,
    SWITCH_IMPORTS,
    ScanRootsComponent,
    TranscriptionPanelComponent,
  ],
})
export class SettingsSourcesViewComponent {
  protected store = injectTimetrackSettings();

  public git = injectGitCollector();
  protected gitlab = injectGitLabCollector();
  protected lock = injectWindowLock();

  protected readonly GITLAB_WHY = GITLAB_WHY;
  protected readonly NOT_A_HOSTNAME = NOT_A_HOSTNAME;
  protected readonly GITHUB_WHY = GITHUB_WHY;
  protected readonly LOCK_WHY = LOCK_WHY;
  protected readonly LOCK_WAIT_WHY = LOCK_WAIT_WHY;

  protected repoPaths = computed(() => this.git.discovery()?.repos ?? []);

  /**
   * The instances `glab` holds a login for, while the field names none of them.
   *
   * A host typed here that `glab` has no credential for reads as a working setup everywhere except
   * the Sources row, so the one field that can be wrong is the one that offers what is right.
   */
  protected glabOffers = computed(() => {
    const auth = this.gitlab.auth();

    if (auth?.state !== 'logged-in') return [];

    const { host } = this.store.settings().gitlab;

    return host && forgeLoginFor(auth, host) ? [] : auth.logins.map((login) => login.host);
  });

  protected gitlabHostNotHostname = computed(() => {
    const { host } = this.store.settings().gitlab;

    return host.length > 0 && !isForgeHostname(host);
  });

  protected gitlabHostname = computed(() => forgeHostname(this.store.settings().gitlab.host));

  protected glabCanWrite = computed(() => {
    const auth = this.gitlab.auth();
    const { host } = this.store.settings().gitlab;

    return !!host && auth?.state === 'logged-in' && !!forgeLoginFor(auth, host);
  });

  protected setGitLabHost(host: string) {
    this.store.setGitLab({ host });
  }
}
