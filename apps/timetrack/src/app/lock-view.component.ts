import { Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { BuildStampComponent } from './build-stamp.component';
import { LogoComponent } from './logo.component';
import { injectWindowLock } from './window-lock';

/**
 * What the window shows instead of a day while it is locked.
 *
 * The password goes straight to the host and into PAM, which is the same route a desktop's own lock
 * screen takes. Nothing here decides whether it was right, and nothing here keeps it.
 */
@Component({
  selector: 'ethlete-lock-view',
  template: `
    <div class="flex h-dvh flex-col items-center justify-center p-6" data-tauri-drag-region="deep">
      <div
        class="flex w-90 flex-col gap-5 rounded-xl border border-et-surface-border bg-et-surface-interaction/8 p-8 shadow-lg"
      >
        <div class="flex flex-col items-start gap-1">
          <div class="w-50"><ethlete-logo /></div>
          <div class="-mt-1"><ethlete-build-stamp /></div>
        </div>

        <div class="flex flex-col gap-1">
          <h1 class="text-h4 m-0">Locked</h1>
          <p class="text-small text-et-surface-subtle">
            Your day is still being collected. Only the reading of it is locked.
          </p>
        </div>

        @if (lock.promptsItself()) {
          <p class="text-small">Unlock to let the system ask you for it.</p>
        } @else {
          <et-form-field appearance="underline" size="sm">
            <et-label>Account password</et-label>
            <et-input [(value)]="password" (keydown.enter)="unlock()" type="password" autocomplete="current-password" />
          </et-form-field>
        }

        @if (lock.wasRefused()) {
          <p class="text-small text-et-error">That is not the account password.</p>
        }

        @if (lock.failure(); as failure) {
          <p class="text-small text-et-error">{{ failure }}</p>
        }

        <div>
          <button [disabled]="!canUnlock()" (click)="unlock()" et-button variant="filled" size="sm">
            {{ lock.isChecking() ? 'Checking…' : 'Unlock' }}
          </button>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, BuildStampComponent, FORM_FIELD_IMPORTS, INPUT_IMPORTS, LogoComponent],
})
export class LockViewComponent {
  protected lock = injectWindowLock();

  protected password = signal('');

  protected canUnlock() {
    return !this.lock.isChecking() && (this.lock.promptsItself() || !!this.password());
  }

  protected unlock() {
    if (!this.canUnlock()) return;

    const password = this.password();

    this.password.set('');
    this.lock.unlock(this.lock.promptsItself() ? undefined : password);
  }
}
