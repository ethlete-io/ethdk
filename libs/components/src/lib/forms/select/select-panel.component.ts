import { Component, ElementRef, ViewEncapsulation, viewChild } from '@angular/core';
import { AutoSurfaceDirective, ProvideColorDirective } from '@ethlete/core';
import { injectOverlaySurfaceContext } from '../form-field/headless';
import { SelectListboxDirective } from './headless';

@Component({
  selector: 'et-select-panel',
  // the listbox is an inner element, not the panel host: a listbox may only contain options/groups,
  // but the loading/empty/error rows and the load-more/add-new buttons must live in the panel too —
  // they render in the extras slot, as siblings of the listbox, keeping the listbox ARIA-clean.
  // the scroller is an inner element, not the panel host: the host paints the chrome
  // (background/border/radius) and must not scroll itself — macOS rubber-band overscroll drags
  // a scroller's own background along with the content, revealing the page behind the panel
  template: `
    <div class="et-select-panel-scroller">
      <div #panelBody class="et-select-panel-body">
        <div class="et-select-listbox" etSelectListbox>
          <ng-content />
        </div>
        <ng-content select="[etSelectPanelExtras]" />
      </div>
    </div>
  `,
  styleUrl: './select-panel.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SelectListboxDirective],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-select-panel',
  },
})
export class SelectPanelComponent {
  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  constructor() {
    injectOverlaySurfaceContext({ panelBody: this.panelBody, resizingClass: 'et-select-panel--resizing' });
  }
}
