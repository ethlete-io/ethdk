import { Component, EnvironmentInjector, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { createLegacyQueryCreator, def, QueryMockConfig, RequestError, V2QueryClient } from '@ethlete/query';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import '../../../../test-helpers';
import { DropzoneEntry } from './dropzone-entry';
import { AnyDropzoneUploadConfig, createV2DropzoneUpload, DropzoneUploadHandle } from './dropzone-upload';
import { DropzoneDirective } from './dropzone.directive';

type UploadResponse = { uuid: string };

const UPLOAD_URL = 'https://api.test.com/upload';

const createFile = (name = 'photo.png', type = 'image/png', size = 4) =>
  new File([new Uint8Array(size)], name, { type });

const mockError: RequestError = {
  url: UPLOAD_URL,
  status: 500,
  statusText: 'Server Error',
  detail: { message: 'Upload failed' },
  httpErrorResponse: null as never,
};

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// each state change hops through the debounced query observable and the mock timer, so — like the
// select v2 spec — flush twice: once for the query to reach the state signal, once for it to settle.
const flush = async () => {
  TestBed.tick();
  await settle();
  TestBed.tick();
  await settle();
};

describe('createV2DropzoneUpload', () => {
  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });

  describe('handle (genuine V2QueryClient creator)', () => {
    let injector: Injector;

    const createHandle = (options: {
      mock: QueryMockConfig<UploadResponse>;
      file?: File;
    }): DropzoneUploadHandle<string> => {
      const client = new V2QueryClient({ baseRoute: 'https://api.test.com' });
      const uploadMedia = client.post({
        route: '/upload',
        reportProgress: true,
        types: {
          args: def<{ body: FormData }>(),
          response: def<UploadResponse>(),
        },
      });

      const upload = createV2DropzoneUpload({
        queryCreator: uploadMedia,
        createArgs: (file) => {
          const body = new FormData();
          body.append('file', file, file.name);

          return { body, mock: options.mock };
        },
        selectValue: (media) => media.uuid,
      });

      return upload.createUploadHandle({ file: options.file ?? createFile(), injector });
    };

    beforeEach(() => {
      TestBed.configureTestingModule({});
      injector = TestBed.inject(EnvironmentInjector);
    });

    it('uploads the file and resolves the control value', async () => {
      const handle = createHandle({ mock: { delay: 0, response: { uuid: 'uuid-1' } } });

      handle.execute();
      await flush();

      expect(handle.state()).toBe('success');
      expect(handle.value()).toBe('uuid-1');
      expect(handle.error()).toBeNull();
      expect(handle.errorMessage()).toBeNull();
    });

    it('surfaces the failure and its first error message', async () => {
      const handle = createHandle({ mock: { delay: 0, error: mockError } });

      handle.execute();
      await flush();

      expect(handle.state()).toBe('error');
      expect(handle.value()).toBeNull();
      expect(handle.error()).toEqual(mockError);
      expect(handle.errorMessage()).toBe('Upload failed');
    });

    it('re-prepares and succeeds on retry', async () => {
      // the mock object is captured in the frozen args — mutating it before re-execute lets the
      // retry resolve differently, exactly like a flaky endpoint that succeeds the second time.
      const mock: QueryMockConfig<UploadResponse> = { delay: 0, error: mockError };
      const handle = createHandle({ mock });

      handle.execute();
      await flush();
      expect(handle.state()).toBe('error');

      mock.error = undefined;
      mock.response = { uuid: 'uuid-retry' };

      handle.execute();
      await flush();

      expect(handle.state()).toBe('success');
      expect(handle.value()).toBe('uuid-retry');
      expect(handle.error()).toBeNull();
    });

    it('reports upload progress while loading', async () => {
      // interval-based mock: emits a progress event every `delay` ms (the first at 0%), then
      // resolves after `eventCount` events. Sample partway through to catch a non-zero percentage.
      const handle = createHandle({
        mock: { delay: 10, progress: { eventCount: 6, fileSize: 100 } },
      });

      handle.execute();
      await flush();
      await settle(35);
      TestBed.tick();

      expect(handle.state()).toBe('uploading');
      expect(handle.progress()).toBeGreaterThan(0);

      await settle(80);
      TestBed.tick();

      expect(handle.state()).toBe('success');
      expect(handle.progress()).toBeNull();
    });

    it('stops tracking the query after dispose', async () => {
      const handle = createHandle({ mock: { delay: 20, response: { uuid: 'uuid-late' } } });

      handle.execute();
      await flush();
      expect(handle.state()).toBe('uploading');

      handle.dispose();
      await settle(30);
      TestBed.tick();

      // the disposed query no longer feeds the handle — no late success leaks in
      expect(handle.value()).toBeNull();
    });
  });

  describe('legacy interop creator', () => {
    let setup: QueryTestSetup;
    let injector: Injector;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      setup = setupQueryTest();
      injector = TestBed.inject(EnvironmentInjector);
    });

    // `AnyLegacyQueryCreator` (a `createLegacyQueryCreator` interop wrapper) is accepted by the same
    // config union as a genuine `V2QueryClient` creator. We only assert the config builds — executing
    // an interop upload to teardown trips a re-entrant `LegacyQuery.destroy()` (NG0205), a known
    // limitation of the legacy interop query itself, not of this adapter. Apps mid-migration should
    // prefer a genuine v2 creator; the select v2 adapter carries the same caveat.
    it('accepts a legacy interop creator', () => {
      const uploadMedia = createLegacyQueryCreator({
        creator: setup.createPost<{ response: UploadResponse; body: FormData }>('/upload'),
      });

      const upload = createV2DropzoneUpload({
        queryCreator: uploadMedia,
        selectValue: (media) => media.uuid,
      });

      expect(typeof upload.createUploadHandle).toBe('function');
      expect(typeof upload.selectValue).toBe('function');

      // build a handle (no execute → no interop query is prepared, so no teardown re-entrancy)
      const handle = upload.createUploadHandle({ file: createFile(), injector });
      expect(handle.state()).toBe('uploading');
    });
  });

  describe('through the dropzone directive', () => {
    @Component({
      template: `
        <div [(value)]="value" [upload]="upload()!" (uploadSucceed)="succeeded.push($event)" etDropzone></div>
      `,
      imports: [DropzoneDirective],
    })
    class V2DropzoneHost {
      upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
      value = signal<string | string[] | null>(null);
      succeeded: DropzoneEntry<string>[] = [];
    }

    let fixture: ComponentFixture<V2DropzoneHost>;
    let host: V2DropzoneHost;

    const dropzone = () =>
      fixture.debugElement.children[0]!.injector.get(DropzoneDirective) as DropzoneDirective<string>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [V2DropzoneHost] });

      const client = new V2QueryClient({ baseRoute: 'https://api.test.com' });
      const uploadMedia = client.post({
        route: '/upload',
        types: {
          args: def<{ body: FormData }>(),
          response: def<UploadResponse>(),
        },
      });

      fixture = TestBed.createComponent(V2DropzoneHost);
      host = fixture.componentInstance;
      host.upload.set(
        createV2DropzoneUpload({
          queryCreator: uploadMedia,
          createArgs: (file) => {
            const body = new FormData();
            body.append('file', file, file.name);

            return { body, mock: { delay: 0, response: { uuid: 'uuid-1' } } };
          },
          selectValue: (media) => media.uuid,
        }),
      );
      fixture.detectChanges();
    });

    it('writes the resolved value into the control and emits uploadSucceed', async () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(dropzone().entries()[0]!.status()).toBe('uploading');
      expect(host.value()).toBeNull();

      await flush();
      fixture.detectChanges();

      expect(dropzone().entries()[0]!.status()).toBe('success');
      expect(host.value()).toBe('uuid-1');
      expect(host.succeeded.length).toBe(1);
    });
  });
});
