import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  RICH_TEXT_EDITOR_IMPORTS,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorFloatingToolbar,
  provideRichTextEditorLinkEditor,
} from '@ethlete/components';

@Component({
  selector: 'app-rich-text-editor-default-example',
  template: `
    <et-form-field>
      <et-label>Match report</et-label>
      <et-rich-text-editor [formField]="reportForm.report" placeholder="Write something…" />
    </et-form-field>

    <pre>{{ reportForm.report().value() || '(empty value)' }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField],
  providers: [
    provideRichTextEditorDefaultTools(),
    provideRichTextEditorLinkEditor(),
    provideRichTextEditorFloatingToolbar(),
  ],
})
export class RichTextEditorDefaultExampleComponent {
  private model = signal({ report: '' });

  protected reportForm = form(this.model);
}
