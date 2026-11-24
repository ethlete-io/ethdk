import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS, OverlayMainDirective } from '@ethlete/components';
import { REMOVE_PROJECT_DIALOG_LABELS } from '../../i18n/shell-labels';

@Component({
  selector: 'ethlete-remove-project-dialog',
  template: `
    <div etOverlayHeader>
      <h2 class="m-0 text-[1.8rem] leading-normal font-semibold" et-overlay-title>{{ LABELS.title }}</h2>
    </div>
    <div et-overlay-body>
      <p class="m-0 text-ui-md wrap-anywhere text-et-surface">{{ LABELS.question(name()) }}</p>
    </div>
    <div class="flex justify-end gap-space-2 px-space-3 pb-space-3">
      <button (click)="close.emit()" et-button type="button" variant="transparent" size="sm">
        {{ LABELS.cancel }}
      </button>
      <button (click)="confirm.emit(); close.emit()" et-button type="button" variant="filled" size="sm">
        {{ LABELS.confirm }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
  hostDirectives: [OverlayMainDirective],
})
export class RemoveProjectDialogComponent {
  public name = input.required<string>();

  public confirm = output();

  // eslint-disable-next-line @angular-eslint/no-output-native -- matches the other Studio dialogs
  public close = output();

  protected readonly LABELS = REMOVE_PROJECT_DIALOG_LABELS;
}
