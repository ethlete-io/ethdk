import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  RICH_TEXT_EDITOR_IMPORTS,
  RichTextViewerComponent,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorTableTool,
} from '@ethlete/components';

@Component({
  selector: 'app-rich-text-viewer-beside-editor-example',
  template: `
    <et-form-field>
      <et-label>Editor</et-label>
      <et-rich-text-editor [formField]="reportForm.body" />
    </et-form-field>

    <et-rich-text-viewer [value]="reportForm.body().value()" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField, RichTextViewerComponent],
  providers: [provideRichTextEditorDefaultTools(), provideRichTextEditorTableTool()],
})
export class RichTextViewerBesideEditorExampleComponent {
  private model = signal({
    body: '# Match report\n\nA short intro with **bold**, *italic*, <u>underline</u>, ~~strikethrough~~ and `inline code`.\n\n## Highlights\n\n- First half\n  - Early goal\n- Second half\n\n1. Kick-off\n2. Final whistle\n\n> A quoted line from the coach.\n\n```\nconst goals = 3;\n```\n\n| Team | Goals |\n| :--- | ---: |\n| Home | 3 |\n| Away | 1 |\n\nRead more on [the club site](https://example.com).\n\nRaw HTML stays text: <script>alert(1)</script>',
  });

  protected reportForm = form(this.model);
}
