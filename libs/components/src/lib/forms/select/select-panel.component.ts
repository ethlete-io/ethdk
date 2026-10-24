import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { AutoSurfaceDirective, ProvideColorDirective, injectAnimatedListItems } from '@ethlete/core';
import { injectOverlaySurfaceContext } from '../form-field/headless';
import { SelectDirective, SelectListboxDirective, SelectViewportDirective } from './headless';
import { SELECT_SPRING } from './select-spring';

@Component({
  selector: 'et-select-panel',
  // a listbox may only own options and groups, so the state and action rows render beside it.
  // The host must not scroll: macOS rubber-band overscroll drags a scroller's own background along.
  template: `
    <div class="et-select-panel-scroller" etSelectViewport>
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
  imports: [SelectListboxDirective, SelectViewportDirective],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-select-panel',
  },
})
export class SelectPanelComponent {
  private select = inject(SelectDirective);

  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');
  private renderedDataItems = this.select.visibleDataItems();
  private renderedRange = this.select.virtualWindow.range();

  constructor() {
    inject(AutoSurfaceDirective).matchOverlaySurface();

    injectOverlaySurfaceContext({
      panelBody: this.panelBody,
      resizingClass: 'et-select-panel--resizing',
      resizeDuration: SELECT_SPRING.durationMs,
      resizeEasing: SELECT_SPRING.easing,
    });

    injectAnimatedListItems({
      host: this.panelBody,
      items: [
        '.et-select-option',
        '.et-select-option-group-label',
        '.et-select-panel-extras > :not(.et-select-busy-bar)',
      ].join(),
      attributes: ['data-filtered', 'data-hidden'],
      movingClass: 'et-select-panel-body--moving',
      moveDuration: SELECT_SPRING.durationMs,
      moveEasing: SELECT_SPRING.easing,
      leaveDuration: 60,
      animateChange: () => !this.isScrollStep(),
    });
  }

  private isScrollStep() {
    const dataItems = this.select.visibleDataItems();
    const range = this.select.virtualWindow.range();
    const previousRange = this.renderedRange;
    const isScrollStep =
      dataItems === this.renderedDataItems && (range.start !== previousRange.start || range.end !== previousRange.end);

    this.renderedDataItems = dataItems;
    this.renderedRange = range;

    return isScrollStep;
  }
}
