import { JsonPipe } from '@angular/common';
import { Component, computed, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { createPostQuery, createQueryClient, def, V2QueryClient } from '@ethlete/query';
import { HintComponent } from '../../form-field/hint.component';
import { LabelDirective } from '../../form-field/headless';
import { DROPZONE_IMPORTS } from '../dropzone.imports';
import { createDropzoneUpload, createV2DropzoneUpload } from '../headless/dropzone-upload';
import { dropzoneFiles } from '../headless/dropzone-validation';
import { MOCK_UPLOAD_BASE_URL } from './upload-mock';

type MediaLikeView = { uuid: string; name: string };
type UploadMediaArgs = { response: MediaLikeView; body: FormData };

const client = createQueryClient({ baseUrl: MOCK_UPLOAD_BASE_URL, name: 'dropzoneDemo' });

const uploadMedia = createPostQuery(client)<UploadMediaArgs>('/upload', { reportProgress: true });
const uploadMediaFlaky = createPostQuery(client)<UploadMediaArgs>('/upload-flaky', { reportProgress: true });

// Legacy v2 counterpart. The legacy client issues raw XHRs (bypassing Angular interceptors), so the
// demo drives it through the built-in `mock` mechanism instead of the story's HTTP interceptor.
const v2Client = new V2QueryClient({ baseRoute: MOCK_UPLOAD_BASE_URL });
const uploadMediaV2 = v2Client.post({
  route: '/upload',
  reportProgress: true,
  types: { args: def<{ body: FormData }>(), response: def<MediaLikeView>() },
});

@Component({
  selector: 'et-sb-dropzone',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-xl flex-col gap-6 p-8 font-sans">
      <et-dropzone [formField]="demoForm.media" [upload]="upload()" [multiple]="multiple()">
        <et-label>Media</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-dropzone>

      <pre class="text-xs opacity-60">form value: {{ demoForm.media().value() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...DROPZONE_IMPORTS, FormField, HintComponent, LabelDirective, ProvideColorDirective, JsonPipe],
})
export class DropzoneStorybookComponent {
  public color = input('brand');
  public hint = input('');
  public multiple = input(false);
  public accept = input('');
  public maxFileSize = input<number | null>(null);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public flaky = input(false);
  public v2 = input(false);
  public initialValue = input<string | string[] | null>(null);

  protected upload = computed(() => {
    const resolveExisting = (uuid: string) => ({
      name: `media-${uuid}.jpg`,
      previewUrl: `https://picsum.photos/seed/${uuid}/640/480`,
      size: 123456,
    });

    if (this.v2()) {
      return createV2DropzoneUpload({
        queryCreator: uploadMediaV2,
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
        resolveExisting,
      });
    }

    return createDropzoneUpload<UploadMediaArgs, string>({
      queryCreator: this.flaky() ? uploadMediaFlaky : uploadMedia,
      selectValue: (media) => media.uuid,
      resolveExisting,
    });
  });

  private formModel = linkedSignal<{ media: string | string[] | null }>(() => ({
    media: this.initialValue() ?? (this.multiple() ? [] : null),
  }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
    required(s.media, { when: () => this.required(), message: 'Please upload a file' });
    dropzoneFiles(s.media, () => ({
      accept: this.accept() || undefined,
      maxFileSize: this.maxFileSize() ?? undefined,
    }));
  });
}
