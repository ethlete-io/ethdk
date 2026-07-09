import { Component, ViewEncapsulation, computed, effect, inject, untracked } from '@angular/core';
import {
  COLOR_PROVIDER,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  SURFACE_PROVIDER,
  createComponentId,
  injectSurfaceThemes,
  resolveSurfaceByElevation,
  setInputSignal,
} from '@ethlete/core';
import { SpinnerComponent } from '../loader';
import { MenuDirective, MenuPanelDirective } from './headless';

@Component({
  selector: 'et-menu',
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SpinnerComponent],
  hostDirectives: [MenuPanelDirective, ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-menu',
  },
})
export class MenuComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private contextSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  protected menu = inject(MenuDirective, { optional: true });

  private surfaceThemes = injectSurfaceThemes({ optional: true });

  protected search = computed(() => this.menu?.registeredSearch() ?? null);
  protected searchLoading = computed(() => this.search()?.loading() ?? false);
  protected searchError = computed(() => this.search()?.error() ?? null);
  protected searchErrorId = createComponentId('et-menu-search-error');

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const contextSurfaceProvider = this.contextSurfaceProvider;

    if (!themes || !contextSurfaceProvider) {
      return null;
    }

    return (
      resolveSurfaceByElevation(
        themes,
        contextSurfaceProvider.surfaceType() ?? 'dark',
        contextSurfaceProvider.elevation() + 1,
      )?.name ?? null
    );
  });

  constructor() {
    // the panel renders inside a detached overlay pane, so color and surface context
    // from the trigger location has to be re-applied here instead of cascading via the DOM
    effect(() => {
      const contextColorProvider = this.contextColorProvider;

      untracked(() => {
        if (contextColorProvider) {
          this.ownColorProvider.syncWithProvider(contextColorProvider);
        }
      });
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.ownSurfaceProvider.surface, surface);
      });
    });

    // lets the search input reference the error line rendered below it via aria-describedby
    effect(() => {
      this.search()?.errorElementId.set(this.searchErrorId);
    });
  }
}
