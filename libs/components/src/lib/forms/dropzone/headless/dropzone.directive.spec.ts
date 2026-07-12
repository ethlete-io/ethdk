import { Component, ErrorHandler, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import '../../../../test-helpers';
import { FormFieldDirective } from '../../form-field/headless';
import { DropzoneEntry } from './dropzone-entry';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './dropzone-upload';
import { DropzoneFileConstraints, DropzoneFileRejection, dropzoneFiles } from './dropzone-validation';
import { DropzoneDirective } from './dropzone.directive';

type UploadResponse = { uuid: string };
type UploadArgs = { response: UploadResponse; body: FormData };

const UPLOAD_URL = 'https://api.test.com/upload';

const createFile = (name = 'photo.png', type = 'image/png', size = 4) =>
  new File([new Uint8Array(size)], name, { type });

const createDragEvent = (type: string, files: File[] = []) => {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files },
  });

  return event;
};

@Component({
  template: `
    <div
      [(value)]="value"
      [upload]="upload()!"
      [multiple]="multiple()"
      [disabled]="disabled()"
      (filesRejected)="rejections.push($event)"
      (uploadSucceeded)="succeeded.push($event)"
      (uploadFailed)="failed.push($event)"
      etDropzone
    ></div>
  `,
  imports: [DropzoneDirective],
})
class DropzoneTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  multiple = signal(false);
  disabled = signal(false);
  value = signal<string | string[] | null>(null);

  rejections: DropzoneFileRejection[][] = [];
  succeeded: DropzoneEntry<string>[] = [];
  failed: DropzoneEntry<string>[] = [];
}

@Component({
  template: `
    <div etFormField>
      <div [upload]="upload()!" etDropzone></div>
    </div>
  `,
  imports: [DropzoneDirective, FormFieldDirective],
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
      (filesRejected)="rejections.push($event)"
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

const createUploadConfig = (setup: QueryTestSetup, options?: { withResolver?: boolean }) =>
  createDropzoneUpload<UploadArgs, string>({
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
  });

describe('DropzoneDirective', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });

  describe('with test host', () => {
    let fixture: ComponentFixture<DropzoneTestHost>;
    let host: DropzoneTestHost;

    const dropzone = () =>
      fixture.debugElement.children[0]!.injector.get(DropzoneDirective) as DropzoneDirective<string>;
    const dropzoneEl = () => fixture.nativeElement.querySelector('[etDropzone]') as HTMLElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [DropzoneTestHost] });
      setup = setupQueryTest();
      fixture = TestBed.createComponent(DropzoneTestHost);
      host = fixture.componentInstance;
      host.upload.set(createUploadConfig(setup));
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
      setup.httpTesting.verify();
    });

    it('should upload a selected file and write the selected value into the control', () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(dropzone().entries()[0]!.status()).toBe('uploading');
      expect(dropzone().anyUploading()).toBe(true);
      expect(host.value()).toBe(null);

      const req = setup.httpTesting.expectOne(UPLOAD_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);

      req.flush({ uuid: 'uuid-1' });
      fixture.detectChanges();

      expect(dropzone().entries()[0]!.status()).toBe('success');
      expect(dropzone().hasValue()).toBe(true);
      expect(host.value()).toBe('uuid-1');
      expect(host.succeeded.length).toBe(1);
    });

    it('should set touched when files are selected', () => {
      expect(dropzone().touched()).toBe(false);

      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      expect(dropzone().touched()).toBe(true);
      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should create an image preview object url and revoke it on remove', () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      const entry = dropzone().entries()[0]!;
      expect(entry.previewUrl()).toMatch(/^blob:mock-/);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      fixture.detectChanges();

      dropzone().removeEntry(entry.id);
      fixture.detectChanges();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(entry.previewUrl());
    });

    it('should not create an object url for non-image files', () => {
      dropzone().selectFiles([createFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(dropzone().entries()[0]!.previewUrl()).toBe(null);
      expect(URL.createObjectURL).not.toHaveBeenCalled();

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should upload multiple files and keep the control value in entry order', () => {
      host.multiple.set(true);
      fixture.detectChanges();

      dropzone().selectFiles([createFile('a.png'), createFile('b.png')]);
      fixture.detectChanges();

      const requests = setup.httpTesting.match(UPLOAD_URL);
      expect(requests.length).toBe(2);

      // resolve out of order — the value order must follow the entry order
      requests[1]!.flush({ uuid: 'uuid-b' });
      fixture.detectChanges();
      expect(host.value()).toEqual(['uuid-b']);

      requests[0]!.flush({ uuid: 'uuid-a' });
      fixture.detectChanges();
      expect(host.value()).toEqual(['uuid-a', 'uuid-b']);
    });

    it('should replace the current entry in single mode', () => {
      dropzone().selectFiles([createFile('a.png')]);
      fixture.detectChanges();
      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      fixture.detectChanges();

      expect(host.value()).toBe('uuid-a');
      const firstEntry = dropzone().entries()[0]!;

      dropzone().selectFiles([createFile('b.png')]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(dropzone().entries()[0]).not.toBe(firstEntry);
      expect(host.value()).toBe(null);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstEntry.previewUrl());

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-b' });
      fixture.detectChanges();

      expect(host.value()).toBe('uuid-b');
    });

    it('should only keep the first file in single mode and reject the rest', () => {
      dropzone().selectFiles([createFile('a.png'), createFile('b.png')]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(host.rejections[0]).toEqual([{ file: expect.any(File), reason: 'maxFiles' }]);

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    });

    it('should cancel the upload when an in-flight entry is removed', () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      const req = setup.httpTesting.expectOne(UPLOAD_URL);
      const entry = dropzone().entries()[0]!;

      dropzone().removeEntry(entry.id);
      fixture.detectChanges();

      expect(req.cancelled).toBe(true);
      expect(dropzone().entries().length).toBe(0);
      expect(host.value()).toBe(null);
    });

    it('should update the control value when a successful entry is removed', () => {
      host.multiple.set(true);
      fixture.detectChanges();

      dropzone().selectFiles([createFile('a.png'), createFile('b.png')]);
      fixture.detectChanges();

      const requests = setup.httpTesting.match(UPLOAD_URL);
      requests[0]!.flush({ uuid: 'uuid-a' });
      requests[1]!.flush({ uuid: 'uuid-b' });
      fixture.detectChanges();

      expect(host.value()).toEqual(['uuid-a', 'uuid-b']);

      dropzone().removeEntry(dropzone().entries()[0]!.id);
      fixture.detectChanges();

      expect(host.value()).toEqual(['uuid-b']);
    });

    it('should keep failed uploads out of the control value and retry with the original args', () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      const firstReq = setup.httpTesting.expectOne(UPLOAD_URL);
      const firstBody = firstReq.request.body;
      firstReq.flush('upload failed', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      const entry = dropzone().entries()[0]!;
      expect(entry.status()).toBe('error');
      expect(entry.error()).toBeTruthy();
      expect(dropzone().anyFailed()).toBe(true);
      expect(host.value()).toBe(null);
      expect(host.failed.length).toBe(1);

      dropzone().retryEntry(entry.id);
      fixture.detectChanges();

      const retryReq = setup.httpTesting.expectOne(UPLOAD_URL);
      expect(retryReq.request.body).toBe(firstBody);

      retryReq.flush({ uuid: 'uuid-1' });
      fixture.detectChanges();

      expect(entry.status()).toBe('success');
      expect(host.value()).toBe('uuid-1');
    });

    it('should clear all entries and reset the control value', () => {
      host.multiple.set(true);
      fixture.detectChanges();

      dropzone().selectFiles([createFile('a.png')]);
      fixture.detectChanges();
      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      fixture.detectChanges();

      dropzone().clear();
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(0);
      expect(host.value()).toEqual([]);
    });

    it('should hydrate existing entries from an inbound control value', () => {
      host.multiple.set(true);
      host.value.set(['e1', 'e2']);
      fixture.detectChanges();

      const entries = dropzone().entries();
      expect(entries.length).toBe(2);
      expect(entries[0]!.status()).toBe('existing');
      expect(entries[0]!.name()).toBe('existing-e1');
      expect(entries[0]!.previewUrl()).toBe('https://cdn.test.com/e1');
      expect(entries[0]!.value()).toBe('e1');
      expect(dropzone().hasValue()).toBe(true);

      dropzone().removeEntry(entries[0]!.id);
      fixture.detectChanges();

      expect(host.value()).toEqual(['e2']);
    });

    it('should hydrate a single existing entry in single mode', () => {
      host.value.set('e1');
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(dropzone().entries()[0]!.status()).toBe('existing');
      expect(dropzone().entries()[0]!.name()).toBe('existing-e1');
    });

    it('should keep uploading entries when the value is reconciled', () => {
      host.multiple.set(true);
      fixture.detectChanges();

      dropzone().selectFiles([createFile('a.png')]);
      fixture.detectChanges();

      host.value.set(['e1']);
      fixture.detectChanges();

      const entries = dropzone().entries();
      expect(entries.length).toBe(2);
      expect(entries[0]!.status()).toBe('existing');
      expect(entries[1]!.status()).toBe('uploading');

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
      fixture.detectChanges();

      expect(host.value()).toEqual(['e1', 'uuid-a']);
    });

    it('should not upload while disabled', () => {
      host.disabled.set(true);
      fixture.detectChanges();

      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(0);
      setup.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should track drag over state via dragenter/dragleave', () => {
      const element = dropzoneEl();

      element.dispatchEvent(createDragEvent('dragenter'));
      fixture.detectChanges();

      expect(dropzone().isDragOver()).toBe(true);
      expect(element.getAttribute('data-drag-over')).toBe('true');

      element.dispatchEvent(createDragEvent('dragleave'));
      fixture.detectChanges();

      expect(dropzone().isDragOver()).toBe(false);
      expect(element.getAttribute('data-drag-over')).toBe(null);
    });

    it('should upload dropped files and reset the drag over state', () => {
      const element = dropzoneEl();

      element.dispatchEvent(createDragEvent('dragenter'));
      element.dispatchEvent(createDragEvent('drop', [createFile()]));
      fixture.detectChanges();

      expect(dropzone().isDragOver()).toBe(false);
      expect(dropzone().entries().length).toBe(1);

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    });

    it('should ignore drag events while disabled', () => {
      host.disabled.set(true);
      fixture.detectChanges();

      dropzoneEl().dispatchEvent(createDragEvent('dragenter'));
      fixture.detectChanges();

      expect(dropzone().isDragOver()).toBe(false);
      expect(dropzoneEl().getAttribute('data-disabled')).toBe('true');
    });

    it('should dispose all entries on destroy', () => {
      dropzone().selectFiles([createFile()]);
      fixture.detectChanges();

      const req = setup.httpTesting.expectOne(UPLOAD_URL);

      fixture.destroy();

      expect(req.cancelled).toBe(true);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  describe('with form schema constraints (dropzoneFiles)', () => {
    let fixture: ComponentFixture<DropzoneSchemaTestHost>;
    let host: DropzoneSchemaTestHost;

    const dropzone = () =>
      fixture.debugElement.children[0]!.injector.get(DropzoneDirective) as DropzoneDirective<string>;
    const fieldErrors = () => host.demoForm.media().errors();

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [DropzoneSchemaTestHost] });
      setup = setupQueryTest();
      fixture = TestBed.createComponent(DropzoneSchemaTestHost);
      host = fixture.componentInstance;
      host.upload.set(createUploadConfig(setup));
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
      setup.httpTesting.verify();
    });

    it('should read the accept constraint from the schema', () => {
      host.constraints.set({ accept: 'image/*' });
      fixture.detectChanges();

      expect(dropzone().accept()).toBe('image/*');
    });

    it('should reject files not matching accept and put a validation error on the field', () => {
      host.constraints.set({ accept: 'image/*' });
      fixture.detectChanges();

      dropzone().selectFiles([createFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(0);
      expect(host.rejections[0]).toEqual([{ file: expect.any(File), reason: 'accept' }]);
      expect(dropzone().lastRejections()).toEqual([{ file: expect.any(File), reason: 'accept' }]);
      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"doc.pdf" has an unsupported file type.' }),
      ]);
      expect(host.demoForm.media().invalid()).toBe(true);
      setup.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should reject files exceeding maxFileSize with the built-in message', () => {
      host.constraints.set({ maxFileSize: 2 });
      fixture.detectChanges();

      dropzone().selectFiles([createFile('big.png', 'image/png', 10)]);
      fixture.detectChanges();

      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"big.png" is too large (max 2 B).' }),
      ]);
      setup.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should reject files below minFileSize', () => {
      host.constraints.set({ minFileSize: 10 });
      fixture.detectChanges();

      dropzone().selectFiles([createFile('tiny.png', 'image/png', 2)]);
      fixture.detectChanges();

      expect(fieldErrors()).toEqual([
        expect.objectContaining({ kind: 'dropzoneFiles', message: '"tiny.png" is too small (min 10 B).' }),
      ]);
      setup.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should use a custom rejection message when provided', () => {
      host.constraints.set({ accept: 'image/*', message: (rejection) => `nope: ${rejection.file.name}` });
      fixture.detectChanges();

      dropzone().selectFiles([createFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(fieldErrors()).toEqual([expect.objectContaining({ kind: 'dropzoneFiles', message: 'nope: doc.pdf' })]);
      setup.httpTesting.expectNone(UPLOAD_URL);
    });

    it('should clear the validation errors on the next valid selection', () => {
      host.constraints.set({ accept: 'image/*' });
      fixture.detectChanges();

      dropzone().selectFiles([createFile('doc.pdf', 'application/pdf')]);
      fixture.detectChanges();

      expect(fieldErrors().length).toBe(1);

      dropzone().selectFiles([createFile('pic.png')]);
      fixture.detectChanges();

      expect(fieldErrors()).toEqual([]);
      expect(dropzone().lastRejections()).toEqual([]);

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
      fixture.detectChanges();

      expect(host.model().media).toBe('uuid-1');
    });

    it('should reject extra files in single mode with the built-in message', () => {
      dropzone().selectFiles([createFile('a.png'), createFile('b.png')]);
      fixture.detectChanges();

      expect(dropzone().entries().length).toBe(1);
      expect(fieldErrors()).toEqual([
        expect.objectContaining({
          kind: 'dropzoneFiles',
          message: '"b.png" was not added (only one file is allowed).',
        }),
      ]);

      setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    });
  });

  describe('inside form field', () => {
    it('should register and unregister with the parent form field', () => {
      TestBed.configureTestingModule({ imports: [DropzoneInFormFieldTestHost] });
      setup = setupQueryTest();

      const fixture = TestBed.createComponent(DropzoneInFormFieldTestHost);
      fixture.componentInstance.upload.set(createUploadConfig(setup));
      fixture.detectChanges();

      const formFieldDir = fixture.debugElement.children[0]!.injector.get(FormFieldDirective);
      expect(formFieldDir.registeredControl()).toBeTruthy();
      expect(formFieldDir.registeredControl()!.controlType()).toBe('dropzone');

      fixture.destroy();
      expect(formFieldDir.registeredControl()).toBe(null);
    });
  });

  describe('dev mode errors', () => {
    it('should throw when the control value is an array in single mode', () => {
      TestBed.configureTestingModule({ imports: [DropzoneTestHost] });
      setup = setupQueryTest();

      const fixture = TestBed.createComponent(DropzoneTestHost);
      fixture.componentInstance.upload.set(createUploadConfig(setup));
      fixture.componentInstance.value.set(['a', 'b']);

      expect(() => fixture.detectChanges()).toThrow(/ET2402/);
    });

    it('should throw when the control has an initial value but no resolveExisting is configured', () => {
      TestBed.configureTestingModule({ imports: [DropzoneTestHost] });
      setup = setupQueryTest();

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
      setup = setupQueryTest({ mockErrorHandler: false });

      const fixture = TestBed.createComponent(DropzoneTestHost);
      fixture.componentInstance.upload.set({} as AnyDropzoneUploadConfig<string>);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(errors.some((error) => String(error).includes('ET2400'))).toBe(true);
    });
  });
});
