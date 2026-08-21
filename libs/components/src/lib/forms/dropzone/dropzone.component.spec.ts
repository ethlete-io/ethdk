import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import '../../../test-helpers';
import { LabelDirective } from '../form-field/headless';
import { MountedDropzoneDriver, mountDropzone } from '../testing/dropzone-driver';
import { DropzoneComponent } from './dropzone.component';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './headless/dropzone-upload';
import { DropzoneFileConstraints, dropzoneFiles } from './headless/dropzone-validation';

type UploadArgs = { response: { uuid: string }; body: FormData };

const UPLOAD_URL = 'https://api.test.com/upload';

const createFile = (name = 'photo.png', type = 'image/png', size = 4) =>
  new File([new Uint8Array(size)], name, { type });

@Component({
  template: `
    <et-dropzone [(value)]="value" [upload]="upload()!" [multiple]="multiple()">
      <et-label>Attachments</et-label>
    </et-dropzone>
  `,
  imports: [DropzoneComponent, LabelDirective],
})
class DropzoneComponentTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  multiple = signal(false);
  value = signal<string | string[] | null>(null);
}

@Component({
  template: `
    <et-dropzone [formField]="demoForm.media" [upload]="upload()!">
      <et-label>Media</et-label>
    </et-dropzone>
  `,
  imports: [DropzoneComponent, LabelDirective, FormField],
})
class DropzoneSchemaComponentTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  constraints = signal<DropzoneFileConstraints>({});

  model = signal<{ media: string | null }>({ media: null });

  demoForm = form(this.model, (s) => {
    dropzoneFiles(s.media, () => this.constraints());
  });
}

describe('DropzoneComponent', () => {
  let driver: MountedDropzoneDriver<DropzoneComponentTestHost>;

  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();

    driver = mountDropzone(DropzoneComponentTestHost);
    driver.host.upload.set(
      createDropzoneUpload<UploadArgs, string>({
        queryCreator: driver.query.createPost<UploadArgs>('/upload'),
        selectValue: (response) => response.uuid,
        resolveExisting: (value) => ({ name: `existing-${value}`, previewUrl: `https://cdn.test.com/${value}` }),
      }),
    );
    driver.tick();
  });

  afterEach(() => {
    driver.fixture.destroy();
    driver.query.httpTesting.verify();
  });

  it('should render the trigger and mirror multiple on the hidden native input', () => {
    driver.host.multiple.set(true);
    driver.tick();

    expect(driver.triggerEl()).toBeTruthy();
    expect(driver.nativeInput().multiple).toBe(true);
    expect(driver.nativeInput().getAttribute('aria-hidden')).toBe('true');
  });

  it('should open the file picker when the trigger is clicked', () => {
    const clickSpy = vi.spyOn(driver.nativeInput(), 'click');

    driver.click(driver.triggerEl());

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('should upload files picked via the native input and reset it', () => {
    driver.pickFiles([createFile()]);

    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    driver.tick();

    expect(driver.host.value()).toBe('uuid-1');
    expect(driver.nativeInput().value).toBe('');
  });

  it('should replace the drop area with a preview in single mode without changing its size', () => {
    expect(driver.previewEl()).toBe(null);

    driver.pickFiles([createFile()]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    driver.tick();

    expect(driver.previewEl()).toBeTruthy();
    expect(driver.areaEl().getAttribute('data-has-preview')).toBe('true');
    // the preview is an absolutely positioned overlay inside the area - the trigger keeps its box
    expect(driver.previewEl()!.parentElement).toBe(driver.areaEl());
    expect(driver.previewImage()).toBeTruthy();
    expect(driver.listEl()).toBe(null);
  });

  it('should render a file list with progress in multiple mode', () => {
    driver.host.multiple.set(true);
    driver.tick();

    driver.pickFiles([createFile('a.png'), createFile('b.png')]);

    expect(driver.itemEls().length).toBe(2);
    expect(driver.itemStatuses()).toEqual(['uploading', 'uploading']);

    // no progress events flushed yet → indeterminate
    expect(driver.itemProgressBar(0)?.classList.contains('et-progress-bar--indeterminate')).toBe(true);

    const requests = driver.query.httpTesting.match(UPLOAD_URL);
    requests[0]!.flush({ uuid: 'uuid-a' });
    requests[1]!.flush({ uuid: 'uuid-b' });
    driver.tick();

    expect(driver.host.value()).toEqual(['uuid-a', 'uuid-b']);
    expect(driver.itemStatuses()).toEqual(['success', 'success']);
  });

  it('should remove an entry via its remove button', () => {
    driver.host.multiple.set(true);
    driver.tick();

    driver.pickFiles([createFile('a.png')]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    driver.tick();

    expect(driver.removeButton(0)!.getAttribute('aria-label')).toBe('Remove a.png');

    driver.click(driver.removeButton(0)!);

    expect(driver.itemEls().length).toBe(0);
    expect(driver.host.value()).toEqual([]);
  });

  it('should show a validation-style error with a retry button for failed uploads', () => {
    driver.host.multiple.set(true);
    driver.tick();

    driver.pickFiles([createFile('a.png')]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush('nope', { status: 500, statusText: 'Server Error' });
    driver.tick();

    expect(driver.itemStatuses()).toEqual(['error']);
    // the error message renders below the field, not inside the entry
    expect(driver.itemInternalErrors(0)).toBe(null);
    expect(driver.internalErrorsText()).toContain('a.png');

    driver.click(driver.retryButton(0)!);

    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    driver.tick();

    expect(driver.host.value()).toEqual(['uuid-a']);
    expect(driver.internalErrors()).toBe(null);
  });

  it('should announce upload activity in the live status region', () => {
    expect(driver.liveStatus()).toBe('');

    driver.pickFiles([createFile()]);

    expect(driver.liveStatus()).toBe('Uploading 1 file');

    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    driver.tick();

    expect(driver.liveStatus()).toBe('');
  });

  it('should render existing values via the resolver', () => {
    driver.host.value.set('e1');
    driver.tick();

    expect(driver.previewEl()!.getAttribute('data-status')).toBe('existing');
    expect(driver.previewName()).toBe('existing-e1');
    expect(driver.previewImage()!.src).toBe('https://cdn.test.com/e1');
  });
});

describe('DropzoneComponent with schema constraints', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('should render schema rejections through the standard validation error region', () => {
    const driver = mountDropzone(DropzoneSchemaComponentTestHost);

    driver.host.constraints.set({ accept: 'image/*' });
    driver.host.upload.set(
      createDropzoneUpload<UploadArgs, string>({
        queryCreator: driver.query.createPost<UploadArgs>('/upload'),
        selectValue: (response) => response.uuid,
      }),
    );
    driver.tick();

    expect(driver.nativeInput().getAttribute('accept')).toBe('image/*');

    driver.pickFiles([createFile('doc.pdf', 'application/pdf')]);

    expect(driver.errorsText()).toContain('doc.pdf');
    expect(driver.errorsText()).toContain('unsupported');
    driver.query.httpTesting.expectNone(UPLOAD_URL);

    driver.fixture.destroy();
    driver.query.httpTesting.verify();
  });
});
