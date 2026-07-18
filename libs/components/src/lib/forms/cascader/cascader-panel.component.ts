import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import {
  AutoSurfaceDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  injectAnimatedBlockSize,
  injectObserveBreakpoint,
} from '@ethlete/core';
import { CascaderDirective } from './headless';

/**
 * The overlay-hosted panel surface: re-applies color/surface context (the pane is detached
 * from the trigger's DOM), tracks whether focus is inside (gating the roving-focus moves),
 * and animates its block size as columns load. Detects sheet vs. anchored presentation.
 */
@Component({
  selector: 'et-cascader-panel',
  template: `
    <div #panelBody class="et-cascader-panel-body">
      <ng-content />
    </div>
  `,
  styleUrl: './cascader-panel.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-cascader-panel',
    role: 'tree',
    '[attr.data-sheet]': 'isSheet() || null',
    '(focusin)': 'handleFocusIn()',
    '(focusout)': 'handleFocusOut($event)',
  },
})
export class CascaderPanelComponent {
  private cascader = inject(CascaderDirective, { optional: true });
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Whether the panel is presented as a bottom sheet (small viewport) — drill mode. Mirrors
   * the overlay's `md` breakpoint that swaps the anchored strategy for the bottom sheet.
   */
  public isSheet = injectObserveBreakpoint({ max: 'sm' });

  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  constructor() {
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    injectAnimatedBlockSize({
      observe: [this.panelBody],
      resizingClass: 'et-cascader-panel--resizing',
    });
  }

  protected handleFocusIn() {
    this.cascader?.focusInside.set(true);
  }

  protected handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !this.hostRef.nativeElement.contains(next)) {
      this.cascader?.focusInside.set(false);
    }
  }
}
