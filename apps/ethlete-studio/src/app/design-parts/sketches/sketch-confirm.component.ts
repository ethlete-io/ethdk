import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, OverlayCloseDirective } from '@ethlete/components';
import { injectSemanticColorTheme } from '@ethlete/core';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';

export type SketchConfirmText = {
  question: string;
  note: string;
  confirm: string;
  lists?: { label: string; items: readonly string[] }[];
};

@Component({
  selector: 'ethlete-sketch-confirm',
  template: `
    <div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
      <div class="flex flex-col gap-space-1">
        <span class="font-ui-strong wrap-anywhere text-et-surface-text">{{ text().question }}</span>
        <span class="text-et-surface-text-muted">{{ text().note }}</span>
      </div>
      @for (list of text().lists ?? []; track list.label) {
        <div class="flex flex-col gap-space-1" data-sk-confirm-list>
          <span class="font-ui-medium text-et-surface-text">{{ list.label }}</span>
          @for (item of list.items; track item) {
            <span class="wrap-anywhere text-et-surface-text-muted">{{ item }}</span>
          }
        </div>
      }
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
  protected readonly LABELS = SKETCHES_LABELS.confirm;
}
