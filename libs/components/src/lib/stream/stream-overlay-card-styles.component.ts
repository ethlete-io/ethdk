import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The card layout, icon, heading and description rules shared by the stream domain's full-bleed
 * overlay states - consent gate, playback error, PiP placeholder - as a styles-only component.
 * Each consumer keeps its own `@property` tokens and public custom-property family and forwards
 * them onto the generic `--et-stream-overlay-card-*` tokens this sheet reads, so the families
 * stay independently overridable.
 *
 * @internal
 */
@Component({
  selector: 'et-stream-overlay-card-styles',
  template: '',
  styleUrl: './stream-overlay-card-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class StreamOverlayCardStylesComponent {}

/** @internal */
export const mountStreamOverlayCardStyles = () => injectStyleManager().mount(StreamOverlayCardStylesComponent);
