import { Component, computed, DestroyRef, inject, input, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, OverlayCloseDirective } from '@ethlete/components';
import { catchError, EMPTY } from 'rxjs';
import { restartForUpdate$ } from '../../../host/update';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export const displayVersion = (version: string) => version.split('+')[0] ?? version;

@Component({
  selector: 'ethlete-update-dialog',
  template: `
    <div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
      <div class="flex flex-col gap-space-1">
        <span class="font-ui-strong wrap-anywhere text-et-surface">{{ question() }}</span>
        <span class="text-et-surface-muted">{{ LABELS.note }}</span>
      </div>
      <div class="flex justify-end gap-space-2">
        <button et-button etOverlayClose variant="outline" color="surface" size="xs">
          {{ LABELS.later }}
        </button>
        <button (click)="restart()" et-button type="button" variant="filled" color="brand" size="xs">
          {{ LABELS.restart }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OverlayCloseDirective],
})
export class UpdateDialogComponent {
  private destroyRef = inject(DestroyRef);

  public version = input.required<string>();

  protected readonly LABELS = STUDIO_LABELS.updateDialog;

  protected question = computed(() => this.LABELS.question(displayVersion(this.version())));

  protected restart() {
    restartForUpdate$()
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a refused restart leaves the downloaded update for the next quit
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
