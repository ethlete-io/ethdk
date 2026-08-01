import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { createDropzoneUpload } from '../../dropzone/headless';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { RichTextEditorTool } from '../rich-text-editor-tools';
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor.imports';
import { provideRichTextEditorHeadingTool } from '../tools/rich-text-editor-heading.provider';
import { provideRichTextEditorImageTool } from '../tools/rich-text-editor-image.provider';
import {
  demoImageFailures,
  postDemoImage,
  postFailingDemoImage,
  recordDemoImageFailure,
} from './rich-text-editor-image-demo.utils';

const IMAGE_TOOLS: readonly RichTextEditorTool[] = [
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

/** Shared shell, so the two image stories differ only in the upload their providers configure. */
@Component({
  selector: 'et-sb-rich-text-editor-image-shell',
  template: `
    <div class="flex max-w-2xl flex-col gap-4 p-8 font-sans" style="--et-rich-text-editor-min-height: 220px">
      <et-form-field>
        <et-label>Article body</et-label>
        <et-rich-text-editor [formField]="demoForm.value" [tools]="TOOLS" placeholder="Write something…" />
        <et-hint>
          Pick an image with the toolbar button, or paste/drop an image file. Click an image to edit its alt text.
        </et-hint>
      </et-form-field>

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{
        demoForm.value().value() || '(empty value)'
      }}</pre>

      <p class="m-0 text-xs opacity-60">Reported failures: {{ FAILURES().join(' · ') || 'none yet' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...RICH_TEXT_EDITOR_IMPORTS, FormField],
})
export class RichTextEditorImageShellComponent {
  protected readonly TOOLS = IMAGE_TOOLS;
  protected readonly FAILURES = demoImageFailures;

  private model = signal({ value: '' });

  public demoForm = form(this.model);
}

/** Uploads through a query (`createDropzoneUpload`), so the placeholder shows real upload progress. */
@Component({
  selector: 'et-sb-rich-text-editor-image',
  template: `<et-sb-rich-text-editor-image-shell />`,
  encapsulation: ViewEncapsulation.None,
  imports: [RichTextEditorImageShellComponent],
  providers: [
    provideRichTextEditorImageTool({
      upload: createDropzoneUpload({ queryCreator: postDemoImage, selectValue: (response) => response.url }),
      maxSize: 5 * 1024 * 1024,
      onFailure: recordDemoImageFailure,
    }),
    provideRichTextEditorHeadingTool(),
  ],
})
export class RichTextEditorImageStorybookComponent {}

/** The failure path: every upload is answered with a 413, so the placeholder shows its failed state. */
@Component({
  selector: 'et-sb-rich-text-editor-image-failure',
  template: `<et-sb-rich-text-editor-image-shell />`,
  encapsulation: ViewEncapsulation.None,
  imports: [RichTextEditorImageShellComponent],
  providers: [
    provideRichTextEditorImageTool({
      upload: createDropzoneUpload({ queryCreator: postFailingDemoImage, selectValue: (response) => response.url }),
      onFailure: recordDemoImageFailure,
    }),
    provideRichTextEditorHeadingTool(),
  ],
})
export class RichTextEditorImageFailureStorybookComponent {}
