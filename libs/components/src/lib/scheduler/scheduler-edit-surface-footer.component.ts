import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { OverlayCloseDirective, OverlayFooterDirective } from '../overlay';
import { injectSchedulerEditSurface } from './headless';
import { injectSchedulerLabels } from './scheduler-labels';

/** The edit surface's footer: Cancel closes it, Save commits the draft. */
@Component({
  selector: 'et-scheduler-edit-surface-footer',
  template: `
    <button et-button etOverlayClose type="button" variant="outline">{{ cancelLabel() }}</button>
    <button [disabled]="!canSave()" (click)="surface.commit()" et-button type="button">{{ saveLabel() }}</button>
  `,
  styleUrl: './scheduler-edit-surface-footer.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, OverlayCloseDirective],
  hostDirectives: [OverlayFooterDirective],
  host: {
    class: 'et-scheduler-edit-surface-footer',
  },
})
export class SchedulerEditSurfaceFooterComponent {
  private labels = injectSchedulerLabels();

  protected surface = injectSchedulerEditSurface();

  /** Whether Save is enabled - bind the validity of the fields that can block a save. */
  public canSave = input(true, { transform: booleanAttribute });

  protected cancelLabel = computed(() => this.labels().cancel);
  protected saveLabel = computed(() => this.labels().save);
}
