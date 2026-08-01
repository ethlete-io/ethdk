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

  /** Accessible name of the picker dialog - set per control (date / time / range / date-time). */
  public dialogLabel = input<string | null>(null);

  // observed instead of the host: the host's used size is overridden by the resize
  // animation itself, so observing it directly would feed the animation back
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  /** The string in effect: this instance's `dialogLabel`, else the domain's label set. */
  protected resolvedDialogLabel = computed(() => this.dialogLabel() ?? this.dateTimeLabels().chooseDate);

  constructor() {
    // this panel IS the overlay's own surface - paint the overlay's registered elevation exactly,
    // don't stack a level above it (the tracker is authoritative; content inside elevates off it)
    inject(AutoSurfaceDirective).matchOverlaySurface();

    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'et-date-picker-panel--resizing' });
  }
}
