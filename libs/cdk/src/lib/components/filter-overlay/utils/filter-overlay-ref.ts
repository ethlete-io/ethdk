import { computed, signal } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { cloneFormGroup } from '@ethlete/core';
import { OverlayRef } from '../../overlay';
import { FilterOverlayConfig, FilterOverlayPageWithLogic, FilterOverlayResult } from '../types';

export class FilterOverlayRef<
  F extends Record<string, AbstractControl> = Record<string, AbstractControl>,
  CType = unknown,
> {
  private readonly _currentRoute = signal<string>('');
  readonly currentRoute = this._currentRoute.asReadonly();

  readonly pages = computed(() =>
    this._config.pages.map((page) => {
      const isActive = computed(() => this.currentRoute() === this._buildRoute(page.route));

      const data: FilterOverlayPageWithLogic = {
        ...page,
        isActive,
      };

      return data;
    }),
  );

  readonly currentPage = computed(() => this.pages().find((page) => page.isActive()));
  readonly currentPageTitle = computed(() => this.currentPage()?.title ?? null);
  readonly canGoBack = computed(() => !!this.currentRoute());
  readonly form = cloneFormGroup(this._config.form as FormGroup<F>);

  overlayRef!: OverlayRef<CType, FilterOverlayResult>;

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

  submit() {
    this._config.form.setValue(this.form.value);
    this.close({ didUpdate: true });
  }

  reset() {
    if (!this._config.defaultFormValue) {
      throw new Error(`The default form value is not defined.`);
    }

    this.form.patchValue(this._config.defaultFormValue);
  }

  goBack() {
    if (!this.canGoBack()) {
      return;
    }

    this.navigateTo('');
  }

  close(data?: FilterOverlayResult) {
    this.overlayRef?.close(data);
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
