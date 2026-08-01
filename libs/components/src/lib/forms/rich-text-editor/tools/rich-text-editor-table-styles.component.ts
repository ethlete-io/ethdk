import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * How tables render inside the editor's content, as a styles-only component mounted by the table
 * tool — an editor without `provideRichTextEditorTableTool()` never pulls these rules in.
 *
 * @internal
 */
@Component({
  selector: 'et-rich-text-editor-table-styles',
  template: '',
  styleUrl: './rich-text-editor-table-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class RichTextEditorTableStylesComponent {}

/** @internal */
export const mountRichTextEditorTableStyles = () => injectStyleManager().mount(RichTextEditorTableStylesComponent);
