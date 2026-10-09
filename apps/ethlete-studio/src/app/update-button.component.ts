import { Component, ViewEncapsulation, signal } from '@angular/core';
import { EMPTY, catchError } from 'rxjs';
import { updateInstall$ } from '../host/update';
import { injectUpdateCheck } from './update-check';

/** Offers the restart once a newer release is downloaded, and shows nothing before that. */
@Component({
  selector: 'ethlete-update-button',
  template: `
    @if (version(); as version) {
      <button
        [disabled]="installing()"
        [title]="failure() ?? 'Installs v' + version + ' and restarts Ethlete Studio'"
        (click)="install()"
        class="studio__verb"
        type="button"
      >
        {{ failure() ? 'Update failed - retry' : 'Restart to update' }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class UpdateButtonComponent {
  protected version = injectUpdateCheck().version;
  protected installing = signal(false);
  protected failure = signal<string | null>(null);

  protected install() {
    this.installing.set(true);
    this.failure.set(null);

    updateInstall$()
      .pipe(
        catchError((error: unknown) => {
          this.installing.set(false);
          this.failure.set(String(error));

          return EMPTY;
        }),
      )
      .subscribe();
  }
}
