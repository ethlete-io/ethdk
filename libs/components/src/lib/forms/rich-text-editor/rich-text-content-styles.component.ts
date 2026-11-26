import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * How rendered rich text looks - headings, lists, quotes, code, links and token chips - as a
 * styles-only component shared by `et-rich-text-editor` and `et-rich-text-viewer`.
 *
 * @internal
 */
@Component({
  selector: 'et-rich-text-content-styles',
  template: '',
  styleUrl: './rich-text-content-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class RichTextContentStylesComponent {}

/** @internal */
export const mountRichTextContentStyles = () => injectStyleManager().mount(RichTextContentStylesComponent);
