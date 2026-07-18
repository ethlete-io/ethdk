import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective, injectAnimatedBlockSize } from '@ethlete/core';
import { SelectListboxDirective } from './headless';

@Component({
  selector: 'et-select-panel',
  // the listbox is an inner element, not the panel host: a listbox may only contain options/groups,
  // but the loading/empty/error rows and the load-more/add-new buttons must live in the panel too —
  // they render in the extras slot, as siblings of the listbox, keeping the listbox ARIA-clean.
  template: `
    <div #panelBody class="et-select-panel-body">
      <div class="et-select-listbox" etSelectListbox>
        <ng-content />
      </div>
      <ng-content select="[etSelectPanelExtras]" />
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
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  constructor() {
    // the panel renders inside a detached overlay pane, so color context from the
    // trigger location has to be re-applied here instead of cascading via the DOM
    // (the surface context is handled the same way by AutoSurfaceDirective). Synced
    // in the constructor so the theme is applied before the first painted frame of
    // the enter animation — an effect would flush one render too late.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    // animate the panel's block size when its content changes while open
    // (filtering, async options arriving, load-more)
    injectAnimatedBlockSize({
      observe: [this.panelBody],
      resizingClass: 'et-select-panel--resizing',
    });
  }
}
