import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TOGGLETIP_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-toggletip-default-example',
  template: `
    <div class="app-example-row">
      <button
        etToggletip="A click-triggered toggletip for richer, interactive guidance."
        et-button
        etToggletipTrigger
        type="button"
        variant="outline"
      >
        Text toggletip
      </button>

      <button
        [etToggletip]="templateToggletip()"
        etToggletipAriaLabel="Matchday note"
        et-button
        etToggletipTrigger
        type="button"
        variant="tonal"
      >
        Interactive toggletip
      </button>
    </div>

    <ng-template #toggletipTemplateRef>
      <div>
        <strong>Matchday Note</strong>
        <p>This toggletip keeps focus free instead of trapping it.</p>
      </div>

      <div>
        <button et-text-button size="xs" type="button">Secondary Action</button>
        <button etToggletipClose et-button size="xs" type="button" variant="transparent">Dismiss</button>
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOGGLETIP_IMPORTS],
})
export class ToggletipDefaultExampleComponent {
  protected templateToggletip = viewChild.required<TemplateRef<unknown>>('toggletipTemplateRef');
}
