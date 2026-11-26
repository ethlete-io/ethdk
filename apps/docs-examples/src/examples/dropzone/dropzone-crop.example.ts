import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  DROPZONE_CROP_IMPORTS,
  DROPZONE_IMPORTS,
  DropzoneCropConfig,
  FORM_FIELD_IMPORTS,
  createDropzoneUpload,
  dropzoneFiles,
} from '@ethlete/components';
import { createPostQuery, createQueryClient } from '@ethlete/query';

type UploadMediaArgs = { response: { uuid: string; name: string }; body: FormData };

const client = createQueryClient({ baseUrl: 'https://dropzone.demo', name: 'dropzoneCropExample' });

const uploadMedia = createPostQuery(client)<UploadMediaArgs>('/upload', { reportProgress: true });

@Component({
  selector: 'app-dropzone-crop-example',
  template: `
    <et-dropzone [formField]="avatarForm.avatar" [upload]="upload" [crop]="CROP">
      <et-label>Avatar</et-label>
      <et-hint>Square crop, at most 256 px wide</et-hint>
    </et-dropzone>

    <p>Form value: {{ avatarForm.avatar().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DROPZONE_IMPORTS, DROPZONE_CROP_IMPORTS, FormField, JsonPipe],
})
export class DropzoneCropExampleComponent {
  protected readonly CROP: DropzoneCropConfig = { aspectRatio: 1, maxWidth: 256, type: 'image/webp', quality: 0.85 };

  protected upload = createDropzoneUpload<UploadMediaArgs, string>({
    queryCreator: uploadMedia,
    selectValue: (media) => media.uuid,
  });

  private model = signal<{ avatar: string | null }>({ avatar: null });

  protected avatarForm = form(this.model, (path) => {
    dropzoneFiles(path.avatar, { accept: 'image/*' });
  });
}
