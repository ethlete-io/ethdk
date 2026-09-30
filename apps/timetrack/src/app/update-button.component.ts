import { Component, ViewEncapsulation, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { EMPTY, catchError, of } from 'rxjs';
import { updateInstall$, updateReady$ } from '../host';

/** Offers the restart once a newer release is downloaded, and shows nothing before that. */
@Component({
  selector: 'ethlete-update-button',
  template: `
    @if (version(); as version) {
      <button
        [disabled]="installing()"
        [title]="failure() ?? 'Installs v' + version + ' and restarts Timetrack'"
        (click)="install()"
        et-button
        variant="filled"
        size="sm"
      >
        {{ failure() ? 'Update failed - retry' : 'Restart to update' }}
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class UpdateButtonComponent {
  protected version = toSignal(updateReady$().pipe(catchError(() => of(null))), { initialValue: null });
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
