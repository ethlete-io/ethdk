import { ComponentType } from '@angular/cdk/portal';
import { FormGroup } from '@angular/forms';
import { OverlayConfig } from '../../../overlay';

export interface FilterOverlayPage {
  /**
   * The component to render.
   */
  component: ComponentType<unknown>;

  /**
   * The route of the page.
   *
   * @example
   * "" // The root route
   * "two" // The route "two"
   */
  route: string;

  /**
   * The title of the page.
   */
  title?: string;

  /**
   * The inputs to pass to the component.
   */
  inputs?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FilterOverlayConfig<F extends FormGroup<any> = FormGroup<any>, D = unknown> {
  form: F;
  defaultFormValue?: ReturnType<F['getRawValue']>;
  initialRoute?: string;
  pages: FilterOverlayPage[];
  overlay: OverlayConfig<D>;
}

export interface FilterOverlayResult {
  didUpdate: boolean;
}
