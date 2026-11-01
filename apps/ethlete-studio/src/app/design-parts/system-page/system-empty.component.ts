import { booleanAttribute, Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-system-empty',
  template: `
    <div [class]="!flush() ? 'ps-(--st-shell-inset-left)' : ''" class="flex h-full items-center justify-center">
      <div class="flex w-2xl flex-col items-center gap-space-4 text-center text-ui-sm">
        <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">
          @for (box of GHOST_BOXES; track box) {
            <span class="block h-10 w-15 rounded-sm bg-et-surface-bg outline outline-et-surface-border"></span>
          }
        </div>
        <p class="m-0 text-ui-md font-ui-strong text-et-surface">{{ LABELS.emptyTitle }}</p>
        <p class="m-0 text-et-surface-muted">{{ LABELS.emptyExplainer }}</p>
        <p class="m-0 rounded-(--radius-control-md) bg-et-surface-bg p-space-3 text-ui-sm text-et-surface">
          {{ LABELS.emptyPrompt(product()) }}
        </p>
        <button (click)="copyPrompt.emit()" et-button type="button" variant="outline" size="sm">
          {{ LABELS.copyPrompt }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  host: { class: 'contents' },
})
export class SystemEmptyComponent {
  public product = input('studio');
  public flush = input(false, { transform: booleanAttribute });
  public copyPrompt = output();

  protected readonly LABELS = STUDIO_LABELS.system;
  protected readonly GHOST_BOXES = [0, 1, 2, 3];
}
