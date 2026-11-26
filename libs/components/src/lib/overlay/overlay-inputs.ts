import { InputSignalWithTransform } from '@angular/core';

declare const OVERLAY_RESULT_TYPE: unique symbol;

/** Carries an overlay's result type for inference. Create it with {@link overlayResult}. */
export type OverlayResultMarker<TResult> = { readonly [OVERLAY_RESULT_TYPE]: TResult };

/**
 * Types an overlay's result without restating its component:
 * `defineOverlay({ component: ProductOverlayComponent, result: overlayResult<ProductResult>() })`.
 */
export const overlayResult = <TResult>() => ({}) as OverlayResultMarker<TResult>;

type OverlayInputWriteType<TMember> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TMember extends InputSignalWithTransform<any, infer TWrite> ? TWrite : never;

type OverlayInputKeys<TComponent> = {
  [K in keyof TComponent]-?: [OverlayInputWriteType<TComponent[K]>] extends [never] ? never : K;
}[keyof TComponent];

/**
 * The component's signal inputs, keyed by property name, each set through a getter that is
 * re-read like an `inputBinding`. Every key is optional: a required input looks the same as an
 * optional one at the type level.
 */
export type OverlayInputs<TComponent> = {
  [K in OverlayInputKeys<TComponent>]?: () => OverlayInputWriteType<TComponent[K]>;
};

export type OverlayInputsConfig<TComponent> = {
  /** Values for the component's signal inputs, e.g. `{ productId: () => id }`. Applied before `bindings`. */
  inputs?: NoInfer<OverlayInputs<TComponent>>;
};

/** Config options that are typed against the overlay component. */
export type OverlayTypedConfig<TComponent, TResult> = OverlayInputsConfig<TComponent> & {
  /** Types the overlay's result, see {@link overlayResult}. Has no effect at runtime. */
  result?: OverlayResultMarker<TResult>;
};
