import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import {
  anchoredDialogOverlayStrategy,
  BUTTON_IMPORTS,
  OverlayCloseDirective,
  OverlayConfig,
} from '@ethlete/components';
import { UPDATE_DIALOG_LABELS } from '../../i18n/shell-labels';

export const updateDialogConfigOf = (origin: Element | Event | null): OverlayConfig => ({
  origin,
  role: 'dialog',
  ariaLabel: UPDATE_DIALOG_LABELS.label,
  strategies: anchoredDialogOverlayStrategy(),
});

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

  protected readonly LABELS = UPDATE_DIALOG_LABELS;

  protected question = computed(() => this.LABELS.question(displayVersion(this.version())));
}
