import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { DROPZONE_IMPORTS, FORM_FIELD_IMPORTS, createDropzoneUpload } from '@ethlete/components';
import { createPostQuery, createQueryClient } from '@ethlete/query';

type UploadMediaArgs = { response: { uuid: string; name: string }; body: FormData };

const client = createQueryClient({ baseUrl: 'https://dropzone.demo', name: 'dropzoneCompactRowExample' });

const uploadMedia = createPostQuery(client)<UploadMediaArgs>('/upload-flaky', { reportProgress: true });

@Component({
  selector: 'app-dropzone-compact-row-example',
  template: `
    <et-dropzone [formField]="mediaForm.contract" [upload]="upload" layout="row">
      <et-label>Signed contract</et-label>
      <et-hint>The first upload of each file fails with a server message</et-hint>
    </et-dropzone>

    <p>Form value: {{ mediaForm.contract().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DROPZONE_IMPORTS, FormField, JsonPipe],
})
export class DropzoneCompactRowExampleComponent {
  protected upload = createDropzoneUpload<UploadMediaArgs, string>({
    queryCreator: uploadMedia,
    selectValue: (media) => media.uuid,
    selectFileInfo: (media) => ({ name: media.name, uploadedAt: new Date() }),
    resolveExisting: (uuid) => ({
      name: `${uuid}.pdf`,
      size: 482_133,
      mimeType: 'application/pdf',
      uploadedAt: '2026-02-11T09:12:00.000Z',
    }),
  });

  private model = signal<{ contract: string | null }>({ contract: 'contract' });

  protected mediaForm = form(this.model);
}
