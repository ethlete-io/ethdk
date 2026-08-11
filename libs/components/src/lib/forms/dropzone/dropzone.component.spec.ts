import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import '../../../test-helpers';
import { LabelDirective } from '../form-field/headless';
import { DropzoneComponent } from './dropzone.component';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './headless/dropzone-upload';
import { DropzoneFileConstraints, dropzoneFiles } from './headless/dropzone-validation';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';

type UploadArgs = { response: { uuid: string }; body: FormData };

const UPLOAD_URL = 'https://api.test.com/upload';

const ensureResizeObserverMock = () => {
  if (globalThis.ResizeObserver) {
    return;
  }

  class ResizeObserverMock {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  });
};

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
  let setup: QueryTestSetup;
  let fixture: ComponentFixture<DropzoneComponentTestHost>;
  let host: DropzoneComponentTestHost;

  const nativeInput = () => fixture.nativeElement.querySelector('.et-dropzone-native-input') as HTMLInputElement;
  const trigger = () => fixture.nativeElement.querySelector('.et-dropzone-trigger') as HTMLButtonElement;

  const selectFilesViaInput = (files: File[]) => {
    const inputElement = nativeInput();

    Object.defineProperty(inputElement, 'files', { value: files, configurable: true });
    inputElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    ensureResizeObserverMock();
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();

    TestBed.configureTestingModule({
      imports: [DropzoneComponentTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    setup = setupQueryTest();

    fixture = TestBed.createComponent(DropzoneComponentTestHost);
    host = fixture.componentInstance;
    host.upload.set(
      createDropzoneUpload<UploadArgs, string>({
        queryCreator: setup.createPost<UploadArgs>('/upload'),
        selectValue: (response) => response.uuid,
        resolveExisting: (value) => ({ name: `existing-${value}`, previewUrl: `https://cdn.test.com/${value}` }),
      }),
    );
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    setup.httpTesting.verify();
  });

  it('should render the trigger and mirror multiple on the hidden native input', () => {
    host.multiple.set(true);
    fixture.detectChanges();

    expect(trigger()).toBeTruthy();
    expect(nativeInput().multiple).toBe(true);
    expect(nativeInput().getAttribute('aria-hidden')).toBe('true');
  });

  it('should open the file picker when the trigger is clicked', () => {
    const clickSpy = vi.spyOn(nativeInput(), 'click');

    trigger().click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('should upload files picked via the native input and reset it', () => {
    selectFilesViaInput([createFile()]);

    setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    fixture.detectChanges();

    expect(host.value()).toBe('uuid-1');
    expect(nativeInput().value).toBe('');
  });

  it('should replace the drop area with a preview in single mode without changing its size', () => {
    const area = fixture.nativeElement.querySelector('.et-dropzone-area') as HTMLElement;

    expect(fixture.nativeElement.querySelector('.et-dropzone-preview')).toBe(null);

    selectFilesViaInput([createFile()]);
    setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.et-dropzone-preview') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(area.getAttribute('data-has-preview')).toBe('true');
    // the preview is an absolutely positioned overlay inside the area - the trigger keeps its box
    expect(preview.parentElement).toBe(area);
    expect(fixture.nativeElement.querySelector('.et-dropzone-preview-image')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.et-dropzone-list')).toBe(null);
  });

  it('should render a file list with progress in multiple mode', () => {
    host.multiple.set(true);
    fixture.detectChanges();

    selectFilesViaInput([createFile('a.png'), createFile('b.png')]);

    const items = fixture.nativeElement.querySelectorAll('.et-dropzone-item');
    expect(items.length).toBe(2);
    expect(items[0]!.getAttribute('data-status')).toBe('uploading');

    // no progress events flushed yet → indeterminate
    const progressBar = items[0]!.querySelector('et-progress-bar');
    expect(progressBar?.classList.contains('et-progress-bar--indeterminate')).toBe(true);

    const requests = setup.httpTesting.match(UPLOAD_URL);
    requests[0]!.flush({ uuid: 'uuid-a' });
    requests[1]!.flush({ uuid: 'uuid-b' });
    fixture.detectChanges();

    expect(host.value()).toEqual(['uuid-a', 'uuid-b']);
    expect(fixture.nativeElement.querySelectorAll('.et-dropzone-item[data-status="success"]').length).toBe(2);
  });

  it('should remove an entry via its remove button', () => {
    host.multiple.set(true);
    fixture.detectChanges();

    selectFilesViaInput([createFile('a.png')]);
    setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      '.et-dropzone-item .et-dropzone-remove-button',
    ) as HTMLButtonElement;
    expect(removeButton.getAttribute('aria-label')).toBe('Remove a.png');

    removeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.et-dropzone-item').length).toBe(0);
    expect(host.value()).toEqual([]);
  });

  it('should show a validation-style error with a retry button for failed uploads', () => {
    host.multiple.set(true);
    fixture.detectChanges();

    selectFilesViaInput([createFile('a.png')]);
    setup.httpTesting.expectOne(UPLOAD_URL).flush('nope', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('.et-dropzone-item') as HTMLElement;
    expect(item.getAttribute('data-status')).toBe('error');
    // the error message renders below the field, not inside the entry
    expect(item.querySelector('.et-dropzone-internal-errors')).toBe(null);

    const errorRegion = fixture.nativeElement.querySelector('.et-dropzone-internal-errors') as HTMLElement;
    expect(errorRegion).toBeTruthy();
    expect(errorRegion.textContent).toContain('a.png');

    (item.querySelector('.et-dropzone-retry-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    fixture.detectChanges();

    expect(host.value()).toEqual(['uuid-a']);
    expect(fixture.nativeElement.querySelector('.et-dropzone-internal-errors')).toBe(null);
  });

  it('should announce upload activity in the live status region', () => {
    const liveRegion = () => fixture.nativeElement.querySelector('.et-dropzone-live-status') as HTMLElement;

    expect(liveRegion().textContent?.trim()).toBe('');

    selectFilesViaInput([createFile()]);

    expect(liveRegion().textContent?.trim()).toBe('Uploading 1 file');

    setup.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    fixture.detectChanges();

    expect(liveRegion().textContent?.trim()).toBe('');
  });

  it('should render existing values via the resolver', () => {
    host.value.set('e1');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('.et-dropzone-preview') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.getAttribute('data-status')).toBe('existing');
    expect(preview.querySelector('.et-dropzone-entry-name')?.textContent).toBe('existing-e1');
    expect((preview.querySelector('.et-dropzone-preview-image') as HTMLImageElement).src).toBe(
      'https://cdn.test.com/e1',
    );
  });
});

describe('DropzoneComponent with schema constraints', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    ensureResizeObserverMock();
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();

    TestBed.configureTestingModule({
      imports: [DropzoneSchemaComponentTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    setup = setupQueryTest();
  });

  it('should render schema rejections through the standard validation error region', () => {
    const fixture = TestBed.createComponent(DropzoneSchemaComponentTestHost);
    const host = fixture.componentInstance;
    host.constraints.set({ accept: 'image/*' });
    host.upload.set(
      createDropzoneUpload<UploadArgs, string>({
        queryCreator: setup.createPost<UploadArgs>('/upload'),
        selectValue: (response) => response.uuid,
      }),
    );
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('.et-dropzone-native-input') as HTMLInputElement;
    expect(inputElement.getAttribute('accept')).toBe('image/*');

    Object.defineProperty(inputElement, 'files', {
      value: [createFile('doc.pdf', 'application/pdf')],
      configurable: true,
    });
    inputElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const errorRegion = fixture.nativeElement.querySelector('.et-dropzone-errors') as HTMLElement;
    expect(errorRegion).toBeTruthy();
    expect(errorRegion.textContent).toContain('doc.pdf');
    expect(errorRegion.textContent).toContain('unsupported');
    setup.httpTesting.expectNone(UPLOAD_URL);

    fixture.destroy();
    setup.httpTesting.verify();
  });
});
