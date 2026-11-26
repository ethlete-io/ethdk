import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { DROPZONE_IMPORTS, FORM_FIELD_IMPORTS, createDropzoneUpload, dropzoneFiles } from '@ethlete/components';
import { createPostQuery, createQueryClient } from '@ethlete/query';

type UploadMediaArgs = { response: { uuid: string; name: string }; body: FormData };

const client = createQueryClient({ baseUrl: 'https://dropzone.demo', name: 'dropzoneExample' });

const uploadMedia = createPostQuery(client)<UploadMediaArgs>('/upload', { reportProgress: true });

@Component({
  selector: 'app-dropzone-multiple-example',
  template: `
    <et-dropzone [formField]="mediaForm.media" [upload]="upload" multiple>
      <et-label>Media</et-label>
      <et-hint>Drop several files at once</et-hint>
    </et-dropzone>

    <p>Form value: {{ mediaForm.media().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DROPZONE_IMPORTS, FormField, JsonPipe],
})
export class DropzoneMultipleExampleComponent {
  protected upload = createDropzoneUpload<UploadMediaArgs, string>({
    queryCreator: uploadMedia,
    selectValue: (media) => media.uuid,
  });

  private model = signal<{ media: string[] }>({ media: [] });

  protected mediaForm = form(this.model, (path) => {
    required(path.media, { message: 'Please upload a file' });
    dropzoneFiles(path.media, { maxFileSize: 5 * 1024 * 1024 });
  });
}
