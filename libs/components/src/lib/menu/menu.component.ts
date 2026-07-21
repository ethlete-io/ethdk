import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, viewChild } from '@angular/core';
import {
  AutoSurfaceDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  createComponentId,
  injectAnimatedBlockSize,
  injectErrorTheme,
} from '@ethlete/core';
import { SpinnerComponent } from '../loader';
import { MenuDirective, MenuPanelDirective } from './headless';

const RESIZE_ANIMATION_CLASS = 'et-menu--resizing';

@Component({
  selector: 'et-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, SpinnerComponent],
  hostDirectives: [MenuPanelDirective, ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-menu',
  },
})
export class MenuComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  protected menu = inject(MenuDirective, { optional: true });
  protected errorColorTheme = injectErrorTheme();

  // observed instead of the host: the host's used size is overridden by the resize animation
  // itself, so observing it directly would feed the animation back into the observer
  private headerElement = viewChild<ElementRef<HTMLElement>>('menuHeader');
  private bodyElement = viewChild<ElementRef<HTMLElement>>('menuBody');

  protected search = computed(() => this.menu?.registeredSearch() ?? null);
  protected searchLoading = computed(() => this.search()?.loading() ?? false);
  protected searchError = computed(() => this.search()?.error() ?? null);
  protected searchErrorId = createComponentId('et-menu-search-error');

  constructor() {
    // this panel IS the overlay's own surface — adopt the overlay elevation from the trigger
    // context, don't stack a level above it (the tracker is for content rendered inside the panel)
    inject(AutoSurfaceDirective).ignoreOverlaySurfaceContext();

    // the panel renders inside a detached overlay pane, so color context from the
    // trigger location has to be re-applied here instead of cascading via the DOM
    // (the surface context is handled the same way by AutoSurfaceDirective). Synced
    // in the constructor so the theme is applied before the first painted frame of
    // the enter animation — an effect would flush one render too late.
    if (this.contextColorProvider) {
      this.ownColorProvider.syncWithProvider(this.contextColorProvider);
    }

    // lets the search input reference the error line rendered below it via aria-describedby
    effect(() => {
      this.search()?.errorElementId.set(this.searchErrorId);
    });

    // animate the menu's block size when its content changes while open
    // (e.g. search filtering items away or the search error line appearing)
    injectAnimatedBlockSize({
      observe: [this.headerElement, this.bodyElement],
      resizingClass: RESIZE_ANIMATION_CLASS,
    });
  }
}
