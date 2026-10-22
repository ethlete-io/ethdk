import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  RICH_TEXT_EDITOR_IMPORTS,
  RichTextEditorTool,
  provideRichTextEditorAlignmentTool,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorTableTool,
} from '@ethlete/components';

@Component({
  selector: 'app-rich-text-editor-with-table-and-alignment-example',
  template: `
    <et-form-field>
      <et-label>Standings</et-label>
      <et-rich-text-editor [formField]="standingsForm.body" [tools]="TOOLS" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField],
  providers: [
    provideRichTextEditorDefaultTools(),
    provideRichTextEditorTableTool(),
    provideRichTextEditorAlignmentTool(),
  ],
})
export class RichTextEditorWithTableAndAlignmentExampleComponent {
  protected readonly TOOLS: readonly RichTextEditorTool[] = [
    'heading',
    'divider',
    'bold',
    'italic',
    'underline',
    'strike',
    'divider',
    'bulletedList',
    'numberedList',
    'divider',
    'align',
    'table',
  ];

  private model = signal({
    body: '## Standings\n\n| Team | Points |\n| :--- | ---: |\n| Berlin | 42 |\n| Hamburg | 39 |\n\nSelect a paragraph and use the align tool to center or right-align it.',
  });

  protected standingsForm = form(this.model);
}
