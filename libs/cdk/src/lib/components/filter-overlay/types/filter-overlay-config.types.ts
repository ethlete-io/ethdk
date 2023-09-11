import { ComponentType } from '@angular/cdk/portal';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayConfig } from '../../overlay';

export interface FilterOverlayPage {
  component: ComponentType<unknown>;

  /**
   * The route of the page.
   *
   * @example
   * "" // The root route
   * "two" // The route "two"
   */
  route: string;
  inputs?: Record<string, unknown>;
}

export interface FilterOverlayPageWithLogic extends FilterOverlayPage {
  isActive: Signal<boolean>;
}

export interface FilterOverlayConfig<D = unknown> {
  form: FormGroup;
  defaultFormValue: unknown;
  initialRoute?: string;
  pages: FilterOverlayPage[];
  overlay: OverlayConfig<D>;
}
