import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import {
  AnimatedSizeAxis,
  AutoSurfaceDirective,
  ProvideColorDirective,
  createComponentId,
  injectObserveBreakpoint,
  injectStyleManager,
} from '@ethlete/core';
import { CascaderBreadcrumbStylesComponent } from './cascader-breadcrumb-styles.component';
import { CascaderSheetStylesComponent } from './cascader-sheet-styles.component';
import { injectOverlaySurfaceContext } from '../form-field/headless';
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
    // a "columnar tree": each level is a sibling `role="group"` related by `aria-level`, not by
    // `aria-owns` back to its parent node. This is a deliberate deviation from a strict single-root
    // tree - the column layout is the whole point - and node keyboard nav bridges the levels.
    // While a flat search is active the columns are replaced by a flat result list, so the panel
    // reports itself as the listbox owning those options instead.
    '[attr.role]': 'role()',
    '[attr.aria-multiselectable]': 'multiselectable()',
    '[attr.data-sheet]': 'isSheet() || null',
    '(focusin)': 'handleFocusIn()',
    '(focusout)': 'handleFocusOut($event)',
  },
})
export class CascaderPanelComponent {
  private cascader = inject(CascaderDirective, { optional: true });
  private hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private styleManager = injectStyleManager();

  /**
   * Whether the panel is presented as a bottom sheet (small viewport) - drill mode. Mirrors
   * the overlay's `md` breakpoint that swaps the anchored strategy for the bottom sheet.
   */
  public isSheet = injectObserveBreakpoint({ max: 'sm' });

  private panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  protected role = computed(() => (this.cascader?.isSearching() ? 'listbox' : 'tree'));
  protected multiselectable = computed(() => (this.cascader?.multiple() ? 'true' : null));

  constructor() {
    let hasMountedSheetStyles = false;

    effect(() => {
      if (hasMountedSheetStyles || !this.isSheet()) return;

      hasMountedSheetStyles = true;
      this.styleManager.mount(CascaderSheetStylesComponent);
    });

    let hasMountedBreadcrumbStyles = false;

    effect(() => {
      if (hasMountedBreadcrumbStyles || !this.cascader?.breadcrumbPath().length) return;

      hasMountedBreadcrumbStyles = true;
      this.styleManager.mount(CascaderBreadcrumbStylesComponent);
    });

    // this panel IS the overlay's own surface - paint the overlay's registered elevation exactly,
    // don't stack a level above it (the tracker is authoritative; content inside elevates off it)
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // give the tree a stable id and hand it to the cascader so the trigger's `aria-controls`
    // resolves to a real element (the overlay pane itself is never assigned an id)
    const element = this.hostRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-cascader-tree');
    }

    this.cascader?.panelId.set(element.id);

    inject(DestroyRef).onDestroy(() => {
      if (this.cascader?.panelId() === element.id) {
        this.cascader.panelId.set(null);
      }
    });

    // Desktop (anchored) presentation animates width too - columns drilling in/out and the
    // search-mode swap grow/shrink the panel instead of jumping. The sheet is viewport-wide,
    // so its width must keep following the pane (animating it would feed back into itself).
    injectOverlaySurfaceContext({
      panelBody: this.panelBody,
      resizingClass: 'et-cascader-panel--resizing',
      axes: computed((): AnimatedSizeAxis[] => (this.isSheet() ? ['block'] : ['block', 'inline'])),
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
