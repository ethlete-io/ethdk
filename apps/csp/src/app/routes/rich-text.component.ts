import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  provideRichTextEditorAlignmentTool,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorFloatingToolbar,
  provideRichTextEditorLinkEditor,
  provideRichTextEditorTableTool,
  RICH_TEXT_EDITOR_IMPORTS,
} from '@ethlete/components';

const INITIAL = `# Initial content

Some **bold** and a [link](https://example.com).

| Left | Right |
| :--- | ----: |
| a    | b     |
`;

@Component({
  selector: 'app-rich-text',
  template: `
    <et-form-field>
      <et-label>Body</et-label>
      <et-rich-text-editor [formField]="editorForm.body" data-testid="editor" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField],
  providers: [
    provideRichTextEditorDefaultTools(),
    provideRichTextEditorAlignmentTool(),
    provideRichTextEditorTableTool(),
    provideRichTextEditorLinkEditor(),
    provideRichTextEditorFloatingToolbar(),
  ],
})
export class RichTextRouteComponent {
  protected editorForm = form(signal({ body: INITIAL }));
}
