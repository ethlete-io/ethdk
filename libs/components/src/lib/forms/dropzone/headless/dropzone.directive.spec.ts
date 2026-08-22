import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { MountedDropzoneDriver, mountDropzone } from '../../testing/dropzone-driver';
import { DropzoneEntry } from './dropzone-entry';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './dropzone-upload';
import { DropzoneFileConstraints, DropzoneFileRejection, dropzoneFiles } from './dropzone-validation';
import { DropzoneDirective } from './dropzone.directive';

type UploadResponse = { uuid: string };
type UploadArgs = { response: UploadResponse; body: FormData };
type DeleteArgs = { response: void; pathParams: { id: string } };

const UPLOAD_URL = 'https://api.test.com/upload';
const deleteUrl = (id: string) => `https://api.test.com/media/${id}`;

const createFile = (name = 'photo.png', type = 'image/png', size = 4) =>
  new File([new Uint8Array(size)], name, { type });

@Component({
  template: `
    <div
      [(value)]="value"
      [upload]="upload()!"
      [multiple]="multiple()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      (filesReject)="rejections.push($event)"
      (uploadSucceed)="succeeded.push($event)"
      (uploadFail)="failed.push($event)"
      (deleteSucceed)="deleteSucceeded.push($event)"
      (deleteFail)="deleteFailed.push($event)"
      etDropzone
    ></div>
  `,
  imports: [DropzoneDirective],
})
class DropzoneTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  multiple = signal(false);
  disabled = signal(false);
  readonly = signal(false);
  value = signal<string | string[] | null>(null);

  rejections: DropzoneFileRejection[][] = [];
  succeeded: DropzoneEntry<string>[] = [];
  failed: DropzoneEntry<string>[] = [];
  deleteSucceeded: string[] = [];
  deleteFailed: { value: string; error: unknown }[] = [];
}

@Component({
  template: `
    <div etFormField>
      <et-label>Media</et-label>
      <div [upload]="upload()!" etDropzone></div>
    </div>
  `,
  imports: [DropzoneDirective, FormFieldDirective, LabelDirective],
})
class DropzoneInFormFieldTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
}

@Component({
  template: `
    <div
      [upload]="upload()!"
      [multiple]="multiple()"
      [formField]="demoForm.media"
      (filesReject)="rejections.push($event)"
      etDropzone
    ></div>
  `,
  imports: [DropzoneDirective, FormField],
})
class DropzoneSchemaTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  multiple = signal(false);
  constraints = signal<DropzoneFileConstraints>({});

  model = signal<{ media: string | string[] | null }>({ media: null });

  demoForm = form(this.model, (s) => {
    dropzoneFiles(s.media, () => this.constraints());
  });

  rejections: DropzoneFileRejection[][] = [];
}

const createUploadConfig = (
  setup: QueryTestSetup,
  options?: { withResolver?: boolean; withDelete?: boolean; includeExisting?: boolean },
) =>
  createDropzoneUpload<UploadArgs, string, DeleteArgs>({
    queryCreator: setup.createPost<UploadArgs>('/upload'),
    selectValue: (response) => response.uuid,
    ...(options?.withResolver === false
      ? {}
      : {
          resolveExisting: (value) => ({
            name: `existing-${value}`,
            previewUrl: `https://cdn.test.com/${value}`,
            size: 1234,
          }),
        }),
    ...(options?.withDelete
      ? {
          delete: {
            queryCreator: setup.createDelete<DeleteArgs>((pathParams) => `/media/${pathParams.id}`),
            createArgs: (value: string) => ({ pathParams: { id: value } }),
            includeExisting: options.includeExisting,
          },
        }
      : {}),
  });

describe('DropzoneDirective', () => {
  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });

  describe('with test host', () => {
    let driver: MountedDropzoneDriver<DropzoneTestHost>;

    beforeEach(() => {
      driver = mountDropzone(DropzoneTestHost);
      driver.host.upload.set(createUploadConfig(driver.query));
      driver.tick();
    });

    afterEach(() => {
      driver.fixture.destroy();
      driver.query.httpTesting.verify();
    });

    it('should upload a selected file and write the selected value into the control', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.dropzone.entries()[0]!.status()).toBe('uploading');
      expect(driver.dropzone.anyUploading()).toBe(true);
      expect(driver.host.value()).toBe(null);

      const req = driver.query.httpTesting.expectOne(UPLOAD_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);

      req.flush({ uuid: 'uuid-1' });
      driver.tick();

      expect(driver.dropzone.entries()[0]!.status()).toBe('success');
      expect(driver.dropzone.hasValue()).toBe(true);
      expect(driver.host.value()).toBe('uuid-1');
      expect(driver.host.succeeded.length).toBe(1);
    });

    it('should set touched when files are selected', () => {
      expect(driver.dropzone.touched()).toBe(false);

      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      expect(driver.dropzone.touched()).toBe(true);
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should create an image preview object url and revoke it on remove', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      const entry = driver.dropzone.entries()[0]!;
      expect(entry.previewUrl()).toMatch(/^blob:mock-/);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      driver.tick();

      driver.dropzone.removeEntry(entry.id);
      driver.tick();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(entry.previewUrl());
    });

    it('should not create an object url for non-image files', () => {
      driver.dropzone.selectFiles([createFile('doc.pdf', 'application/pdf')]);
      driver.tick();

      expect(driver.dropzone.entries()[0]!.previewUrl()).toBe(null);
      expect(URL.createObjectURL).not.toHaveBeenCalled();

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should upload multiple files and keep the control value in entry order', () => {
      driver.host.multiple.set(true);
      driver.tick();

      driver.dropzone.selectFiles([createFile('a.png'), createFile('b.png')]);
      driver.tick();

      const requests = driver.query.httpTesting.match(UPLOAD_URL);
      expect(requests.length).toBe(2);

      // resolve out of order - the value order must follow the entry order
      requests[1]!.flush({ uuid: 'uuid-b' });
      driver.tick();
      expect(driver.host.value()).toEqual(['uuid-b']);

      requests[0]!.flush({ uuid: 'uuid-a' });
      driver.tick();
      expect(driver.host.value()).toEqual(['uuid-a', 'uuid-b']);
    });

    it('should replace the current entry in single mode', () => {
      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      driver.tick();

      expect(driver.host.value()).toBe('uuid-a');
      const firstEntry = driver.dropzone.entries()[0]!;

      driver.dropzone.selectFiles([createFile('b.png')]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.dropzone.entries()[0]).not.toBe(firstEntry);
      expect(driver.host.value()).toBe(null);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstEntry.previewUrl());

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-b' });
      driver.tick();

      expect(driver.host.value()).toBe('uuid-b');
    });

    it('should only keep the first file in single mode and reject the rest', () => {
      driver.dropzone.selectFiles([createFile('a.png'), createFile('b.png')]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.host.rejections[0]).toEqual([{ file: expect.any(File), reason: 'maxFiles' }]);

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    });

    it('should cancel the upload when an in-flight entry is removed', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      const req = driver.query.httpTesting.expectOne(UPLOAD_URL);
      const entry = driver.dropzone.entries()[0]!;

      driver.dropzone.removeEntry(entry.id);
      driver.tick();

      expect(req.cancelled).toBe(true);
      expect(driver.dropzone.entries().length).toBe(0);
      expect(driver.host.value()).toBe(null);
    });

    it('should update the control value when a successful entry is removed', () => {
      driver.host.multiple.set(true);
      driver.tick();

      driver.dropzone.selectFiles([createFile('a.png'), createFile('b.png')]);
      driver.tick();

      const requests = driver.query.httpTesting.match(UPLOAD_URL);
      requests[0]!.flush({ uuid: 'uuid-a' });
      requests[1]!.flush({ uuid: 'uuid-b' });
      driver.tick();

      expect(driver.host.value()).toEqual(['uuid-a', 'uuid-b']);

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      expect(driver.host.value()).toEqual(['uuid-b']);
    });

    it('should keep failed uploads out of the control value and retry with the original args', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      const firstReq = driver.query.httpTesting.expectOne(UPLOAD_URL);
      const firstBody = firstReq.request.body;
      firstReq.flush('upload failed', { status: 500, statusText: 'Server Error' });
      driver.tick();

      const entry = driver.dropzone.entries()[0]!;
      expect(entry.status()).toBe('error');
      expect(entry.error()).toBeTruthy();
      expect(driver.dropzone.anyFailed()).toBe(true);
      expect(driver.host.value()).toBe(null);
      expect(driver.host.failed.length).toBe(1);

      driver.dropzone.retryEntry(entry.id);
      driver.tick();

      const retryReq = driver.query.httpTesting.expectOne(UPLOAD_URL);
      expect(retryReq.request.body).toBe(firstBody);

      retryReq.flush({ uuid: 'uuid-1' });
      driver.tick();

      expect(entry.status()).toBe('success');
      expect(driver.host.value()).toBe('uuid-1');
    });

    it('should clear all entries and reset the control value', () => {
      driver.host.multiple.set(true);
      driver.tick();

      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      driver.tick();

      driver.dropzone.clear();
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(0);
      expect(driver.host.value()).toEqual([]);
    });

    it('should not clear while readonly or disabled', () => {
      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      driver.tick();

      driver.host.readonly.set(true);
      driver.tick();
      driver.dropzone.clear();
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.host.value()).toBe('uuid-a');

      driver.host.readonly.set(false);
      driver.host.disabled.set(true);
      driver.tick();
      driver.dropzone.clear();
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.host.value()).toBe('uuid-a');
    });

    it('should hydrate existing entries from an inbound control value', () => {
      driver.host.multiple.set(true);
      driver.host.value.set(['e1', 'e2']);
      driver.tick();

      const entries = driver.dropzone.entries();
      expect(entries.length).toBe(2);
      expect(entries[0]!.status()).toBe('existing');
      expect(entries[0]!.name()).toBe('existing-e1');
      expect(entries[0]!.previewUrl()).toBe('https://cdn.test.com/e1');
      expect(entries[0]!.value()).toBe('e1');
      expect(driver.dropzone.hasValue()).toBe(true);

      driver.dropzone.removeEntry(entries[0]!.id);
      driver.tick();

      expect(driver.host.value()).toEqual(['e2']);
    });

    it('should hydrate a single existing entry in single mode', () => {
      driver.host.value.set('e1');
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(driver.dropzone.entries()[0]!.status()).toBe('existing');
      expect(driver.dropzone.entries()[0]!.name()).toBe('existing-e1');
    });

    it('should keep uploading entries when the value is reconciled', () => {
      driver.host.multiple.set(true);
      driver.tick();

      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();

      driver.host.value.set(['e1']);
      driver.tick();

      const entries = driver.dropzone.entries();
      expect(entries.length).toBe(2);
      expect(entries[0]!.status()).toBe('existing');
      expect(entries[1]!.status()).toBe('uploading');

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      driver.tick();

      expect(driver.host.value()).toEqual(['e1', 'uuid-a']);
    });

    it('should not upload while disabled', () => {
      driver.host.disabled.set(true);
      driver.tick();

      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(0);
      driver.query.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should track drag over state via dragenter/dragleave', () => {
      driver.drag('dragenter');

      expect(driver.dropzone.isDragOver()).toBe(true);
      expect(driver.attr('data-drag-over')).toBe('true');

      driver.drag('dragleave');

      expect(driver.dropzone.isDragOver()).toBe(false);
      expect(driver.attr('data-drag-over')).toBe(null);
    });

    it('should upload dropped files and reset the drag over state', () => {
      driver.drag('dragenter');
      driver.drag('drop', [createFile()]);

      expect(driver.dropzone.isDragOver()).toBe(false);
      expect(driver.dropzone.entries().length).toBe(1);

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should ignore drag events while disabled', () => {
      driver.host.disabled.set(true);
      driver.tick();

      driver.drag('dragenter');

      expect(driver.dropzone.isDragOver()).toBe(false);
      expect(driver.attr('data-disabled')).toBe('true');
    });

    it('should dispose all entries on destroy', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      const req = driver.query.httpTesting.expectOne(UPLOAD_URL);

      driver.fixture.destroy();

      expect(req.cancelled).toBe(true);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete on remove', () => {
    let driver: MountedDropzoneDriver<DropzoneTestHost>;

    // effects (the settlement signal `executeUntilSettled` awaits) only flush on a CD tick, and the
    // resulting promise chain still needs a real microtask turn to run its `.then()`s.
    const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

    beforeEach(() => {
      driver = mountDropzone(DropzoneTestHost);
      driver.host.upload.set(createUploadConfig(driver.query, { withDelete: true, includeExisting: true }));
      driver.tick();
    });

    afterEach(() => {
      driver.fixture.destroy();
      driver.query.httpTesting.verify();
    });

    it('should fire the delete request when a successfully uploaded entry is removed', async () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      driver.tick();

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      const deleteReq = driver.query.httpTesting.expectOne(deleteUrl('uuid-1'));
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush(null);

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.deleteSucceeded).toEqual(['uuid-1']);
      expect(driver.host.deleteFailed).toEqual([]);
    });

    it('should fire the delete request when an existing entry is removed and includeExisting is on', async () => {
      driver.host.value.set('e1');
      driver.tick();

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      driver.query.httpTesting.expectOne(deleteUrl('e1')).flush(null);

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.deleteSucceeded).toEqual(['e1']);
    });

    it('should not delete an existing entry by default, and stay silent about it', async () => {
      driver.host.upload.set(createUploadConfig(driver.query, { withDelete: true }));
      driver.host.value.set('e1');
      driver.tick();

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();
      await flushMicrotasks();
      driver.tick();

      driver.query.httpTesting.expectNone(deleteUrl('e1'));
      expect(driver.host.value()).toBe(null);
      expect(driver.host.deleteSucceeded).toEqual([]);
      expect(driver.host.deleteFailed).toEqual([]);
    });

    it('should still delete an uploaded entry while includeExisting is off', async () => {
      driver.host.upload.set(createUploadConfig(driver.query, { withDelete: true }));
      driver.tick();

      driver.dropzone.selectFiles([createFile()]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      driver.tick();

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      driver.query.httpTesting.expectOne(deleteUrl('uuid-1')).flush(null);

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.deleteSucceeded).toEqual(['uuid-1']);
    });

    it('should emit deleteFail (and not remove the value a second time) when the delete request fails', async () => {
      driver.host.value.set('e1');
      driver.tick();

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      driver.query.httpTesting.expectOne(deleteUrl('e1')).flush('nope', { status: 500, statusText: 'Server Error' });

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.deleteSucceeded).toEqual([]);
      expect(driver.host.deleteFailed.length).toBe(1);
      expect(driver.host.deleteFailed[0]!.value).toBe('e1');
      expect(driver.dropzone.entries().length).toBe(0);
    });

    it('should fire the delete request for the value replaced in single mode', async () => {
      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      driver.tick();

      driver.dropzone.selectFiles([createFile('b.png')]);
      driver.tick();

      driver.query.httpTesting.expectOne(deleteUrl('uuid-a')).flush(null);
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-b' });

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.value()).toBe('uuid-b');
      expect(driver.host.deleteSucceeded).toEqual(['uuid-a']);
    });

    it('should delete the replaced existing value only when includeExisting is on', async () => {
      driver.host.upload.set(createUploadConfig(driver.query, { withDelete: true }));
      driver.host.value.set('e1');
      driver.tick();

      driver.dropzone.selectFiles([createFile('b.png')]);
      driver.tick();

      driver.query.httpTesting.expectNone(deleteUrl('e1'));
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-b' });

      driver.tick();
      await flushMicrotasks();
      driver.tick();

      expect(driver.host.deleteSucceeded).toEqual([]);
    });

    it('should not fire a delete request for a replaced entry that was still uploading', () => {
      driver.dropzone.selectFiles([createFile('a.png')]);
      driver.tick();

      const req = driver.query.httpTesting.expectOne(UPLOAD_URL);

      driver.dropzone.selectFiles([createFile('b.png')]);
      driver.tick();

      expect(req.cancelled).toBe(true);
      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-b' });
    });

    it('should not fire a delete request for a still-uploading entry (nothing persisted yet)', () => {
      driver.dropzone.selectFiles([createFile()]);
      driver.tick();

      const req = driver.query.httpTesting.expectOne(UPLOAD_URL);

      driver.dropzone.removeEntry(driver.dropzone.entries()[0]!.id);
      driver.tick();

      expect(req.cancelled).toBe(true);
      // `afterEach`'s `httpTesting.verify()` would fail if a DELETE request had also been queued.
    });
  });

  describe('with form schema constraints (dropzoneFiles)', () => {
    let driver: MountedDropzoneDriver<DropzoneSchemaTestHost>;

    const fieldErrors = () => driver.host.demoForm.media().errors();

    beforeEach(() => {
      driver = mountDropzone(DropzoneSchemaTestHost);
      driver.host.upload.set(createUploadConfig(driver.query));
      driver.tick();
    });

    afterEach(() => {
      driver.fixture.destroy();
      driver.query.httpTesting.verify();
    });

    it('should read the accept constraint from the schema', () => {
      driver.host.constraints.set({ accept: 'image/*' });
      driver.tick();

      expect(driver.dropzone.accept()).toBe('image/*');
    });

    it('should reject files not matching accept and put a validation error on the field', () => {
      driver.host.constraints.set({ accept: 'image/*' });
      driver.tick();

      driver.dropzone.selectFiles([createFile('doc.pdf', 'application/pdf')]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(0);
      expect(driver.host.rejections[0]).toEqual([{ file: expect.any(File), reason: 'accept' }]);
      expect(driver.dropzone.lastRejections()).toEqual([{ file: expect.any(File), reason: 'accept' }]);
      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"doc.pdf" has an unsupported file type.' }),
      ]);
      expect(driver.host.demoForm.media().invalid()).toBe(true);
      driver.query.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should reject files exceeding maxFileSize with the built-in message', () => {
      driver.host.constraints.set({ maxFileSize: 2 });
      driver.tick();

      driver.dropzone.selectFiles([createFile('big.png', 'image/png', 10)]);
      driver.tick();

      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"big.png" is too large (max 2 B).' }),
      ]);
      driver.query.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should reject files below minFileSize', () => {
      driver.host.constraints.set({ minFileSize: 10 });
      driver.tick();

      driver.dropzone.selectFiles([createFile('tiny.png', 'image/png', 2)]);
      driver.tick();

      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"tiny.png" is too small (min 10 B).' }),
      ]);
      driver.query.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should use a custom rejection message when provided', () => {
      driver.host.constraints.set({ accept: 'image/*', message: (rejection) => `nope: ${rejection.file.name}` });
      driver.tick();

      driver.dropzone.selectFiles([createFile('doc.pdf', 'application/pdf')]);
      driver.tick();

      expect(fieldErrors()).toEqual([expect.objectContaining({ kind: 'dropzoneFiles', message: 'nope: doc.pdf' })]);
      driver.query.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should clear the validation errors on the next valid selection', () => {
      driver.host.constraints.set({ accept: 'image/*' });
      driver.tick();

      driver.dropzone.selectFiles([createFile('doc.pdf', 'application/pdf')]);
      driver.tick();

      expect(fieldErrors().length).toBe(1);

      driver.dropzone.selectFiles([createFile('pic.png')]);
      driver.tick();

      expect(fieldErrors()).toEqual([]);
      expect(driver.dropzone.lastRejections()).toEqual([]);

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      driver.tick();

      expect(driver.host.model().media).toBe('uuid-1');
    });

    it('should reject extra files in single mode with the built-in message', () => {
      driver.dropzone.selectFiles([createFile('a.png'), createFile('b.png')]);
      driver.tick();

      expect(driver.dropzone.entries().length).toBe(1);
      expect(fieldErrors()).toEqual([
        expect.objectContaining({
          kind: 'dropzoneFiles',
          message: '"b.png" was not added (only one file is allowed).',
        }),
      ]);

      driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    });
  });

  describe('inside form field', () => {
    it('should register and unregister with the parent form field', () => {
      const driver = mountDropzone(DropzoneInFormFieldTestHost, { directiveSelector: '[etDropzone]' });

      driver.host.upload.set(createUploadConfig(driver.query));
      driver.tick();

      const formField = driver.directive(FormFieldDirective);

      expect(formField.registeredControl()).toBeTruthy();
      expect(formField.registeredControl()!.controlType()).toBe('dropzone');

      driver.fixture.destroy();
      expect(formField.registeredControl()).toBe(null);
    });
  });

  describe('dev mode errors', () => {
    it('should throw when the control value is an array in single mode', () => {
      TestBed.configureTestingModule({ imports: [DropzoneTestHost] });

      const setup = setupQueryTest();
      const fixture = TestBed.createComponent(DropzoneTestHost);

      fixture.componentInstance.upload.set(createUploadConfig(setup));
      fixture.componentInstance.value.set(['a', 'b']);

      expect(() => fixture.detectChanges()).toThrow(/ET2402/);
    });

    it('should throw when the control has an initial value but no resolveExisting is configured', () => {
      TestBed.configureTestingModule({ imports: [DropzoneTestHost] });

      const setup = setupQueryTest();
      const fixture = TestBed.createComponent(DropzoneTestHost);

      fixture.componentInstance.upload.set(createUploadConfig(setup, { withResolver: false }));
      fixture.componentInstance.value.set('e1');

      expect(() => fixture.detectChanges()).toThrow(/ET2401/);
    });

    it('should report an invalid upload config', async () => {
      const errors: unknown[] = [];

      TestBed.configureTestingModule({
        imports: [DropzoneTestHost],
        providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }],
      });
      setupQueryTest({ mockErrorHandler: false });

      const fixture = TestBed.createComponent(DropzoneTestHost);
      fixture.componentInstance.upload.set({} as AnyDropzoneUploadConfig<string>);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(errors.some((error) => String(error).includes('ET2400'))).toBe(true);
    });
  });
});
