import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor.imports';
import { RichTextEditorTrigger } from '../rich-text-editor-trigger';
import { provideRichTextEditorTokenRendering } from '../rich-text-editor-token-providers';
import { RichTextViewerComponent } from '../rich-text-viewer.component';
import { provideRichTextEditorDefaultTools } from '../tools/rich-text-editor-default-tools.provider';
import { provideRichTextEditorTableTool } from '../tools/rich-text-editor-table.provider';

const MERGE_FIELDS: RichTextEditorTrigger = {
  char: '#',
  type: 'field',
  items: [
    { id: 'firstName', label: 'First name' },
    { id: 'club', label: 'Club' },
  ],
};

@Component({
  selector: 'et-sb-rich-text-viewer',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans" style="max-width: 640px; font-size: 1.4rem">
      <et-rich-text-viewer [value]="value()" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RichTextViewerComponent],
  providers: [provideRichTextEditorTokenRendering([MERGE_FIELDS])],
})
export class RichTextViewerStorybookComponent {
  public value = input('');
}

@Component({
  selector: 'et-sb-rich-text-viewer-beside-editor',
  template: `
    <div class="grid grid-cols-2 gap-8 p-8 font-sans" style="max-width: 1040px; font-size: 1.4rem">
      <et-form-field>
        <et-label>Editor</et-label>
        <et-rich-text-editor [formField]="demoForm.value" />
      </et-form-field>

      <et-rich-text-viewer [value]="demoForm.value().value()" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...RICH_TEXT_EDITOR_IMPORTS, FormField, RichTextViewerComponent],
  providers: [provideRichTextEditorDefaultTools(), provideRichTextEditorTableTool()],
})
export class RichTextViewerBesideEditorStorybookComponent {
  public value = input('');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  protected demoForm = form(this.formModel);
}
