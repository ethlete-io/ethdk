import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { DROPZONE_IMPORTS, FORM_FIELD_IMPORTS, createV2DropzoneUpload } from '@ethlete/components';
import { V2QueryClient, def } from '@ethlete/query';

type MediaLikeView = { uuid: string; name: string };

const client = new V2QueryClient({ baseRoute: 'https://dropzone.demo' });

const uploadMedia = client.post({
  route: '/upload',
  reportProgress: true,
  types: { args: def<{ body: FormData }>(), response: def<MediaLikeView>() },
});

@Component({
  selector: 'app-dropzone-legacy-v-2-query-example',
  template: `
    <et-dropzone [formField]="mediaForm.media" [upload]="upload" multiple>
      <et-label>Media</et-label>
      <et-hint>Uploads run through the legacy V2QueryClient adapter.</et-hint>
    </et-dropzone>

    <p>Form value: {{ mediaForm.media().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, DROPZONE_IMPORTS, FormField, JsonPipe],
})
export class DropzoneLegacyV2QueryExampleComponent {
  protected upload = createV2DropzoneUpload({
    queryCreator: uploadMedia,
    createArgs: (file) => {
      const body = new FormData();
      body.append('file', file, file.name);

      return {
        body,
        mock: {
          delay: 200,
          progress: { eventCount: 6, fileSize: Math.max(file.size, 400_000) },
          response: { uuid: file.name, name: file.name },
        },
      };
    },
    selectValue: (media) => media.uuid,
  });

  private model = signal<{ media: string[] }>({ media: [] });

  protected mediaForm = form(this.model);
}
