import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, OverlayCloseDirective } from '@ethlete/components';
import { injectSemanticColorTheme } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type SketchConfirmText = { question: string; note: string; confirm: string };

@Component({
  selector: 'ethlete-sketch-confirm',
  template: `
    <div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
      <div class="flex flex-col gap-space-1">
        <span class="font-ui-strong wrap-anywhere text-et-surface">{{ text().question }}</span>
        <span class="text-et-surface-muted">{{ text().note }}</span>
      </div>
      <div class="flex justify-end gap-space-2">
        <button
          et-button
          etOverlayClose
          type="button"
          variant="outline"
          color="surface"
          size="xs"
          data-sk-confirm-cancel
        >
          {{ LABELS.cancel }}
        </button>
        <button
          [color]="destructive() ? errorTheme() : undefined"
          (click)="confirm.emit()"
          et-button
          type="button"
          variant="filled"
          size="xs"
          data-sk-confirm
        >
          {{ text().confirm }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OverlayCloseDirective],
})
export class SketchConfirmComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public text = input.required<SketchConfirmText>();

  public destructive = input(false);

  public confirm = output();
  protected readonly LABELS = STUDIO_LABELS.sketches.confirm;
}
