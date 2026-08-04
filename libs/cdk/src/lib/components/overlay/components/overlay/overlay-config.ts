import { Direction } from '@angular/cdk/bidi';
import { Injector, StaticProvider, ViewContainerRef } from '@angular/core';
import { EmptyObject } from '@ethlete/query';
import { OverlayStrategyBreakpoint } from './strategies';

/**
 * Options for where to set focus to automatically on overlay open
 *
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type OverlayAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

/**
 * Valid ARIA roles for a overlay element.
 *
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type OverlayRole = 'dialog' | 'alertdialog';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type OverlayConfig<D = unknown> = {
  /**
   * Conditionally applied overlay strategies based on breakpoints.
   */
  strategies: () => OverlayStrategyBreakpoint[];

  /**
   * Where the attached component should live in Angular's *logical* component tree.
   * This affects what is available for injection and the change detection order for the
   * component instantiated inside of the overlay. This does not affect where the overlay
   * content will be rendered.
   */
  viewContainerRef?: ViewContainerRef;

  /**
   * Injector used for the instantiation of the component to be attached. If provided,
   * takes precedence over the injector indirectly provided by `ViewContainerRef`.
   */
  injector?: Injector;

  /** ID for the overlay. If omitted, a unique one will be generated. */
  id?: string;

  /**
   * The ARIA role of the overlay element.
   * @default 'dialog'
   */
  role?: OverlayRole;

  /**
   * Whether the overlay has a backdrop.
   * @default true
   */
  hasBackdrop?: boolean;

  /**
   * Whether the user can use escape or clicking on the backdrop to close the modal.
   * @default false
   */
  disableClose?: boolean;

  /**
   * Data being injected into the child component.
   * @default null
   */
  data?: D | null;

  /** Layout direction for the overlay's content. */
  direction?: Direction;

  /**
   * ID of the element that describes the overlay.
   * @default null
   */
  ariaDescribedBy?: string | null;

  /**
   * ID of the element that labels the overlay.
   * @default null
   */
  ariaLabelledBy?: string | null;

  /**
   * Aria label to assign to the overlay element.
   * @default null
   */
  ariaLabel?: string | null;

  /**
   * Whether this is a modal overlay. Used to set the `aria-modal` attribute.
   * @default true
   */
  ariaModal?: boolean;

  /**
   * Whether the overlay uses a custom animation.
   * @default false
   */
  customAnimated?: boolean;

  /**
   * Where the overlay should focus on open.
   * Can be one of AutoFocusTarget, or a css selector string.
   * @default 'first-tabbable'
   */
  autoFocus?: OverlayAutoFocusTarget | string;

  /**
   * Whether the overlay should restore focus to the
   * previously-focused element, after it's closed.
   * @default true
   */
  restoreFocus?: boolean;

  /**
   * Whether to wait for the opening animation to finish before trapping focus.
   * @default true
   */
  delayFocusTrap?: boolean;

  /**
   * Whether the overlay should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`). Will be automatically set to false if the overlay contains a overlay router.
   * @default true
   */
  closeOnNavigation?: boolean;

  /**
   * Extra providers to be made available to the overlay.
   *
   * **WARNING**: Avoid providing `@Injectable()` classes such as services here, as they will never be destroyed.
   * This could lead to memory leaks over time.
   */
  providers?: StaticProvider[];

  /**
   * The origin element that triggered the overlay's opening.
   */
  origin?: HTMLElement | MouseEvent | TouchEvent | KeyboardEvent | PointerEvent;
};

/**
 * Configuration utility type for overlays.
 * To be used inside your overlay opener method as a param to be passed to the overlay.open method.
 *
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type OverlayConsumerConfig<D = void> = Omit<OverlayConfig<D>, 'strategies' | 'data'> &
  MaybeOverlayConsumerConfigWithData<D>;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type MaybeOverlayConsumerConfigWithData<D> = D extends void ? EmptyObject : { data: D };
