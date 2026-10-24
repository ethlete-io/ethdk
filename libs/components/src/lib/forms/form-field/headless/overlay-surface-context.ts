import { ElementRef, Signal, inject } from '@angular/core';
import {
  AnimatedSizeAxis,
  COLOR_PROVIDER,
  ProvideColorDirective,
  injectAnimatedBlockSize,
  injectHostElement,
  injectRenderer,
} from '@ethlete/core';
import { FORM_FIELD_TOKEN } from './form-field.tokens';

/**
 * The surface plumbing every overlay panel (`et-select-panel`, `et-cascader-panel`,
 * `et-date-picker-panel`) repeats: the pane is detached from its trigger's DOM, so the color
 * context from the trigger location has to be re-applied here (synced in the constructor so the
 * theme lands before the enter animation's first painted frame), and the panel's block size is
 * animated as its content changes. Call in the panel component's constructor with its `#panelBody`
 * view child and resizing class. Requires `ProvideColorDirective` as a host directive.
 *
 * @internal
 */
export const injectOverlaySurfaceContext = (options: {
  panelBody: Signal<ElementRef<HTMLElement> | undefined>;
  resizingClass: string;
  /** Size axes the panel animates on content changes - see `injectAnimatedBlockSize`. */
  axes?: AnimatedSizeAxis[] | Signal<AnimatedSizeAxis[]>;
  resizeDuration?: number;
  resizeEasing?: string;
}) => {
  const ownColorProvider = inject(ProvideColorDirective);
  const contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  if (contextColorProvider) {
    ownColorProvider.syncWithProvider(contextColorProvider);
  }

  const field = inject(FORM_FIELD_TOKEN, { optional: true });
  const fieldStyle = field ? getComputedStyle(field.element) : null;
  const radius =
    fieldStyle?.getPropertyValue('--et-form-field-control-border-radius') ||
    fieldStyle?.getPropertyValue('--_et-form-field-control-border-radius');

  if (radius) injectRenderer().setCssProperties(injectHostElement(), { '--_et-overlay-surface-radius': radius });

  injectAnimatedBlockSize({
    observe: [options.panelBody],
    resizingClass: options.resizingClass,
    axes: options.axes,
    duration: options.resizeDuration,
    easing: options.resizeEasing,
  });
};
