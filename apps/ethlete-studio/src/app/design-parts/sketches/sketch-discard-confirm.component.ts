import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, OverlayCloseDirective } from '@ethlete/components';
import { injectSemanticColorTheme } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-sketch-discard-confirm',
  template: `
    <div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
      <div class="flex flex-col gap-space-1">
        <span class="font-ui-strong wrap-anywhere text-et-surface">{{ LABELS.question(part()) }}</span>
        <span class="text-et-surface-muted">{{ LABELS.note }}</span>
      </div>
      <div class="flex justify-end gap-space-2">
        <button
          et-button
          etOverlayClose
          type="button"
          variant="outline"
          color="surface"
          size="xs"
          data-sk-discard-cancel
        >
          {{ LABELS.cancel }}
        </button>
        <button
          [color]="errorTheme()"
          (click)="confirm.emit()"
          et-button
          type="button"
          variant="filled"
          size="xs"
          data-sk-discard-confirm
        >
          {{ LABELS.confirm }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OverlayCloseDirective],
})
export class SketchDiscardConfirmComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public part = input.required<string>();

  public confirm = output();
  protected readonly LABELS = STUDIO_LABELS.sketches.discardConfirm;
}
