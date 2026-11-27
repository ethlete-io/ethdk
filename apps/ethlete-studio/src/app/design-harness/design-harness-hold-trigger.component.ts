import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-design-harness-hold-trigger',
  template: `
    <ng-template #content><span class="text-ui-sm text-et-surface-text-muted">Pausiert</span></ng-template>
    <ng-template #reason
      ><span class="font-ui-medium text-et-surface-text">Wartet auf Freigabe: quantity-stepper</span></ng-template
    >
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DesignHarnessHoldTriggerComponent {
  private content = viewChild.required<TemplateRef<unknown>>('content');
  private reason = viewChild.required<TemplateRef<unknown>>('reason');

  public templates() {
    return { content: this.content(), reason: this.reason() };
  }
}
