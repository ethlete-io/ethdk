import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { STATE_GROUPS_SAMPLE_STATES } from '../design-parts/system-page/system-page-sample';

const DRAWN_STATES = new Set(STATE_GROUPS_SAMPLE_STATES);

@Component({
  selector: 'ethlete-design-harness-system-shots',
  template: `
    <ng-template #shot let-frame>
      @if (DRAWN_STATES.has(frame)) {
        <div class="flex h-36 w-60">
          <div class="w-14 border-e border-et-surface-border"></div>
          <div class="flex flex-1 items-center justify-center">
            <div class="h-12 w-24 bg-et-surface-interaction"></div>
          </div>
        </div>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DesignHarnessSystemShotsComponent {
  private shot = viewChild.required<TemplateRef<{ $implicit: string }>>('shot');
  protected readonly DRAWN_STATES = DRAWN_STATES;

  public templates() {
    return { shot: this.shot() };
  }
}
