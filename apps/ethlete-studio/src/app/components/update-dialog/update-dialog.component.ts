import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, OverlayCloseDirective } from '@ethlete/components';
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
        <button (click)="later.emit()" et-button etOverlayClose variant="outline" color="surface" size="xs">
          {{ LABELS.later }}
        </button>
        <button (click)="restart.emit()" et-button type="button" variant="filled" color="brand" size="xs">
          {{ LABELS.restart }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OverlayCloseDirective],
})
export class UpdateDialogComponent {
  public version = input.required<string>();

  public later = output();
  public restart = output();

  protected readonly LABELS = STUDIO_LABELS.updateDialog;

  protected question = computed(() => this.LABELS.question(displayVersion(this.version())));
}
