import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-rich-text-editor-minimal-example',
  template: `
    <et-form-field>
      <et-label>Comment</et-label>
      <et-rich-text-editor [formField]="commentForm.comment" placeholder="Write something…" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField],
})
export class RichTextEditorMinimalExampleComponent {
  private model = signal({ comment: '' });

  protected commentForm = form(this.model);
}
