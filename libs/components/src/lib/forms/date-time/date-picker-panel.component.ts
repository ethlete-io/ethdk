import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective, injectAnimatedBlockSize } from '@ethlete/core';

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
  host: {
    class: 'et-date-picker-panel',
  },
})
export class DatePickerPanelComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  // observed instead of the host: the host's used size is overridden by the resize
  // animation itself, so observing it directly would feed the animation back
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  constructor() {
    // the panel renders inside a detached overlay pane, so color context from the
    // trigger location has to be re-applied here instead of cascading via the DOM.
    // Synced in the constructor so the theme is applied before the first painted
    // frame of the enter animation — an effect would flush one render too late.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    // months cover four to six week rows — animate the height difference while open
    injectAnimatedBlockSize({
      observe: [this.panelBody],
      resizingClass: 'et-date-picker-panel--resizing',
    });
  }
}
