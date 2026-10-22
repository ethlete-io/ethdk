import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  RICH_TEXT_EDITOR_IMPORTS,
  RichTextEditorTool,
  createDropzoneUpload,
  provideRichTextEditorDefaultTools,
  provideRichTextEditorImageTool,
} from '@ethlete/components';
import { createPostQuery, createQueryClient } from '@ethlete/query';

type ImageUploadArgs = { response: { url: string }; body: FormData };

const client = createQueryClient({ name: 'richTextEditorImages', baseUrl: 'https://images.demo' });

const postImage = createPostQuery(client)<ImageUploadArgs>('/images', { reportProgress: true });

@Component({
  selector: 'app-rich-text-editor-images-example',
  template: `
    <et-form-field>
      <et-label>Article body</et-label>
      <et-rich-text-editor [formField]="articleForm.body" [tools]="TOOLS" placeholder="Write something…" />
      <et-hint>
        Pick an image with the toolbar button, or paste/drop an image file. Click an image to edit its alt text.
      </et-hint>
    </et-form-field>

    <pre>{{ articleForm.body().value() || '(empty value)' }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, FormField],
  providers: [
    provideRichTextEditorImageTool({
      upload: createDropzoneUpload({ queryCreator: postImage, selectValue: (response) => response.url }),
      maxSize: 5 * 1024 * 1024,
    }),
    provideRichTextEditorDefaultTools(),
  ],
})
export class RichTextEditorImagesExampleComponent {
  protected readonly TOOLS: readonly RichTextEditorTool[] = [
    'undo',
    'redo',
    'divider',
    'heading',
    'divider',
    'bold',
    'italic',
    'divider',
    'bulletedList',
    'numberedList',
    'divider',
    'link',
    'image',
  ];

  private model = signal({ body: '' });

  protected articleForm = form(this.model);
}
