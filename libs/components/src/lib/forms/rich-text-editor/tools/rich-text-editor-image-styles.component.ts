import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * How image blocks and the upload placeholder render inside the editor's content, as a styles-only
 * component mounted by the image tool — an editor without `provideRichTextEditorImageTool()` never
 * pulls these rules in.
 *
 * @internal
 */
@Component({
  selector: 'et-rich-text-editor-image-styles',
  template: '',
  styleUrl: './rich-text-editor-image-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class RichTextEditorImageStylesComponent {}

/** @internal */
export const mountRichTextEditorImageStyles = () => injectStyleManager().mount(RichTextEditorImageStylesComponent);
