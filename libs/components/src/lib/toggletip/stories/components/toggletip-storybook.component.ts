import { Component, TemplateRef, ViewEncapsulation, input, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { TOGGLETIP_IMPORTS } from '../../toggletip.imports';

@Component({
  selector: 'et-sb-toggletip',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans" style="min-height: 24rem;">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Toggletips</h2>
        <p class="text-small text-white/60">Click-triggered popovers with interactive content and focus left free.</p>
      </header>

      <div class="flex flex-wrap items-center gap-4">
        <button
          [etToggletip]="toggletipText()"
          [placement]="placement()"
          [disabled]="disabled()"
          et-button
          etToggletipTrigger
          type="button"
          variant="outline"
        >
          Text toggletip
        </button>

        <button
          [etToggletip]="templateToggletip()"
          [etToggletipAriaLabel]="templateToggletipAriaLabel()"
          [placement]="placement()"
          et-button
          etToggletipTrigger
          type="button"
          variant="tonal"
        >
          Interactive toggletip
        </button>
      </div>

      <div class="rounded-2xl border border-dashed border-white/15 p-6 text-small text-white/60">
        Toggletips are click-triggered, can contain interactive content, and close on outside press or Escape.
      </div>

      <ng-template #toggletipTemplateRef>
        <div class="max-w-xs" data-toggletip-body>
          <strong>Matchday Note</strong>
          <p>This toggletip uses the new overlay runtime and keeps focus free instead of trapping it.</p>
        </div>

        <div data-toggletip-actions>
          <button et-text-button size="xs" type="button">Secondary Action</button>
          <button etToggletipClose et-button size="xs" type="button" variant="transparent">Dismiss</button>
        </div>
      </ng-template>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOGGLETIP_IMPORTS],
})
export class ToggletipStorybookComponent {
  public placement = input<'top' | 'right' | 'bottom' | 'left'>('top');
  public disabled = input(false);
  protected toggletipText = input('A click-triggered toggletip for richer, interactive guidance.');
  protected templateToggletipAriaLabel = input('Matchday note');

  protected templateToggletip = viewChild.required<TemplateRef<unknown>>('toggletipTemplateRef');
}
