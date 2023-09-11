import { computed, signal } from '@angular/core';
import { FilterOverlayConfig, FilterOverlayPageWithLogic } from '../types';

export class FilterOverlayRef {
  private readonly _currentRoute = signal<string>('');
  readonly currentRoute = this._currentRoute.asReadonly();

  readonly _pages = computed(() =>
    this._config.pages.map((page) => {
      const isActive = computed(() => this.currentRoute() === this._buildRoute(page.route));

      const data: FilterOverlayPageWithLogic = {
        ...page,
        isActive,
      };

      return data;
    }),
  );

  constructor(private readonly _config: FilterOverlayConfig) {
    if (this._config.initialRoute) {
      this.navigateTo(this._config.initialRoute);
    }
  }

  navigateTo(route: string | string[]) {
    route = this._buildRoute(route);

    if (!this._config.pages.some((page) => page.route === route)) {
      throw new Error(`The route "${route}" does not exist.`);
    }

    this._currentRoute.set(route);
  }

  _buildRoute(route: string | string[]) {
    if (Array.isArray(route)) {
      route = route.join('/');
    }

    if (route.startsWith('/')) {
      route = route.slice(1);
    }

    return route;
  }
}
