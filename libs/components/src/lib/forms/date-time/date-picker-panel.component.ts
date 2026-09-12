import { Component, computed, ElementRef, inject, input, viewChild, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective, ProvideColorDirective } from '@ethlete/core';
import { injectOverlaySurfaceContext } from '../form-field/headless';
import { injectDateTimeLabels } from '../../forms/date-time/date-time-labels';

@Component({
  selector: 'et-date-picker-panel',
  template: `
    <div #panelBody class="et-date-picker-panel-body">
      <ng-content />
    </div>
  `,
  styleUrl: './date-picker-panel.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  // the trigger promises `aria-haspopup="dialog"`, so the mounted pane must actually be a named
  // dialog - without this SR users land in an unnamed generic container
  host: {
    class: 'et-date-picker-panel',
    role: 'dialog',
    '[attr.aria-label]': 'resolvedDialogLabel()',
  },
})
export class DatePickerPanelComponent {
  private dateTimeLabels = injectDateTimeLabels();

  /** Accessible name of the picker dialog. */
  public dialogLabel = input<string | null>(null);

  // observed instead of the host: the resize animation overrides the host's used size, so
  // observing it would feed the animation back
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDate);

  constructor() {
    inject(AutoSurfaceDirective).matchOverlaySurface();

    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'et-date-picker-panel--resizing' });
  }
}
