import { ModelSignal, Type, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { OverlayConfig } from './overlay-config';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

/** The name of the model the overlay component must expose to participate in query-param sync. */
export const OVERLAY_QUERY_PARAM_INPUT_NAME = 'overlayQueryParam';

/** The shape a component must have to be usable with {@link defineQueryParamOverlay}. */
export type QueryParamOverlayHost = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overlayQueryParam: ModelSignal<any>;
};

/** Extracts the query param value type from the component's `overlayQueryParam` model. */
export type QueryParamOverlayValue<TComponent> = TComponent extends { overlayQueryParam: ModelSignal<infer TValue> }
  ? Extract<TValue, string>
  : string;

export type OverlayDefinitionConfig<TComponent extends object> = OverlayConfig & {
  /** The overlay component. */
  component: Type<TComponent>;
};

export type QueryParamOverlayDefinitionConfig<TComponent extends object> = OverlayDefinitionConfig<TComponent> & {
  /** The query param key that drives the overlay's open/close lifecycle. */
  queryParamKey: string;
};

export type OverlayDefinition<TComponent extends object = object, TResult = unknown> = {
  kind: 'overlay';

  /** The overlay component. */
  component: Type<TComponent>;

  /** The base overlay config. Opener- and per-open configs are merged on top of it additively. */
  config: OverlayConfig;

  /**
   * Returns the typed overlay ref. Must be called in the injection context of a component
   * opened via this definition.
   * @throws RuntimeError if called outside of an open overlay.
   */
  injectRef: () => OverlayRef<TComponent, TResult>;
};

export type QueryParamOverlayDefinition<TComponent extends object = object, TResult = unknown> = Omit<
  OverlayDefinition<TComponent, TResult>,
  'kind'
> & {
  kind: 'queryParamOverlay';

  /** The query param key that drives the overlay's open/close lifecycle. */
  queryParamKey: string;
};

const injectOverlayRefOrThrow = <TComponent extends object, TResult>() => {
  const overlayRef = inject(OVERLAY_REF, { optional: true });

  if (!overlayRef) {
    throw new RuntimeError(
      OVERLAY_ERROR_CODES.REF_OUTSIDE_OVERLAY,
      '[Overlay] injectRef() must be called inside a component opened via this overlay definition.',
    );
  }

  return overlayRef as OverlayRef<TComponent, TResult>;
};

/**
 * Defines an overlay at module scope: the component plus its base config (strategies, classes,
 * bindings, providers, …), without any dependency injection. Consumers turn the definition into
 * something that can open the overlay via `createOverlayOpener`, and the overlay component
 * itself accesses its typed ref via `definition.injectRef()`.
 *
 * @example
 * export const productOverlay = defineOverlay<ProductOverlayComponent, ProductResult>({
 *   component: ProductOverlayComponent,
 *   strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
 * });
 */
export const defineOverlay = <TComponent extends object, TResult = unknown>(
  config: OverlayDefinitionConfig<TComponent>,
): OverlayDefinition<TComponent, TResult> => {
  const { component, ...overlayConfig } = config;

  return {
    kind: 'overlay',
    component,
    config: overlayConfig,
    injectRef: () => injectOverlayRefOrThrow<TComponent, TResult>(),
  };
};

/**
 * Defines an overlay whose lifecycle is driven by a URL query param: it opens while the param is
 * present and closes (clearing the param) when dismissed. The component must expose an
 * `overlayQueryParam` {@link https://angular.dev/api/core/model | model} — it receives the param
 * value and is kept in two-way sync with the URL.
 *
 * Because opens are triggered by URL state, there is no per-open config; `bindings` and
 * `providers` set on the definition (or on the opener) are applied on every open.
 *
 * @example
 * export const productOverlay = defineQueryParamOverlay({
 *   component: ProductOverlayComponent, // exposes `overlayQueryParam = model<string>()`
 *   queryParamKey: 'product',
 *   strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
 * });
 */
export const defineQueryParamOverlay = <TComponent extends QueryParamOverlayHost, TResult = unknown>(
  config: QueryParamOverlayDefinitionConfig<TComponent>,
): QueryParamOverlayDefinition<TComponent, TResult> => {
  const { component, queryParamKey, ...overlayConfig } = config;

  return {
    kind: 'queryParamOverlay',
    component,
    queryParamKey,
    config: overlayConfig,
    injectRef: () => injectOverlayRefOrThrow<TComponent, TResult>(),
  };
};
