import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '../providers';

/**
 * Declares the `--ease-*` custom properties that every animated stylesheet in the SDK
 * transitions with, as a styles-only component. Mount it from any component or directive whose
 * CSS reads one - without the declaration the whole `transition` shorthand is invalid at
 * computed-value time and the element snaps instead of animating.
 */
@Component({
  selector: 'et-easing-tokens-styles',
  template: '',
  styleUrl: './easing-tokens-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class EasingTokensStylesComponent {}

/** Mounts {@link EasingTokensStylesComponent}. Call from an injection context. */
export const mountEasingTokens = () => injectStyleManager().mount(EasingTokensStylesComponent);
