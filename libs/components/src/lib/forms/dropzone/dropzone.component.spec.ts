import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import '../../../test-helpers';
import { expectDescribedByPointsAtErrors } from '../testing/described-by';
import { HintComponent } from '../form-field/hint.component';
import { mountControl } from '../../testing/control-driver';
import { flushFrames } from '../../testing/driver-core';
import { LabelDirective } from '../form-field/headless';
import { MountedDropzoneDriver, mountDropzone } from '../testing/dropzone-driver';
import { provideDropzoneLabels } from './dropzone-labels';
import { DropzoneComponent } from './dropzone.component';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './headless/dropzone-upload';
import { DropzoneFileConstraints, dropzoneFiles } from './headless/dropzone-validation';

type UploadArgs = { response: { uuid: string }; body: FormData };

const UPLOAD_URL = 'https://api.test.com/upload';

const createFile = (name = 'photo.png', type = 'image/png', size = 4) =>
  new File([new Uint8Array(size)], name, { type });

@Component({
  template: `
    <et-dropzone
      [(value)]="value"
      [upload]="upload()!"
      [multiple]="multiple()"
      [readonly]="readonly()"
      [disabled]="disabled()"
    >
      <et-label>Attachments</et-label>
    </et-dropzone>
  `,
  imports: [DropzoneComponent, LabelDirective],
})
class DropzoneComponentTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  multiple = signal(false);
  readonly = signal(false);
  disabled = signal(false);
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

@Component({
  template: `
    <et-dropzone [upload]="upload()!">
      <et-label>Media</et-label>
    </et-dropzone>
  `,
  imports: [DropzoneComponent, LabelDirective],
  providers: [provideDropzoneLabels({ uploading: (count) => `Lade ${count} Datei${count === 1 ? '' : 'en'} hoch` })],
})
class DropzoneLocalizedComponentTestHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
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

  it('should keep a readonly trigger focusable without opening the file picker', () => {
    driver.host.readonly.set(true);
    driver.tick();

    const trigger = driver.triggerEl();
    const clickSpy = vi.spyOn(driver.nativeInput(), 'click');

    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');

    driver.dropzone.focus();
    expect(document.activeElement).toBe(trigger);

    driver.click(trigger);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('should keep the trigger in the tab order for a readonly single entry', () => {
    driver.host.value.set('e1');
    driver.host.readonly.set(true);
    driver.tick();

    expect(driver.previewEl()).toBeTruthy();
    expect(driver.triggerEl().getAttribute('tabindex')).toBe(null);
  });

  it('should make the file list the focus target of a readonly multi-mode dropzone with files', () => {
    driver.host.multiple.set(true);
    driver.host.value.set(['e1', 'e2']);
    driver.host.readonly.set(true);
    driver.tick();

    const list = driver.listEl()!;
    const labelledBy = list.getAttribute('aria-labelledby');

    expect(list.getAttribute('tabindex')).toBe('0');
    expect(labelledBy && document.getElementById(labelledBy)?.textContent).toContain('Attachments');

    driver.dropzone.focus();
    expect(document.activeElement).toBe(list);

    driver.host.readonly.set(false);
    driver.tick();

    expect(list.getAttribute('tabindex')).toBe(null);
    driver.dropzone.focus();
    expect(document.activeElement).toBe(driver.triggerEl());
  });

  it('should still disable the trigger when disabled', () => {
    driver.host.disabled.set(true);
    driver.tick();

    expect(driver.triggerEl().disabled).toBe(true);
  });

  it('should upload files picked via the native input and reset it', () => {
    driver.pickFiles([createFile()]);

    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    driver.tick();

    expect(driver.host.value()).toBe('uuid-1');
    expect(driver.nativeInput().value).toBe('');
  });

  it('should replace the drop area with a preview in single mode without changing its size', async () => {
    expect(driver.previewEl()).toBe(null);

    driver.pickFiles([createFile()]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });

    await vi.waitFor(() => {
      driver.tick();
      expect(driver.previewImage()).toBeTruthy();
    });

    expect(driver.previewImage()?.getAttribute('src')).toMatch(/^data:image\//);
    expect(driver.previewEl()).toBeTruthy();
    expect(driver.areaEl().getAttribute('data-has-preview')).toBe('true');
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

  it('should restore an entry whose animated removal the control refused', async () => {
    driver.host.multiple.set(true);
    driver.tick();

    driver.pickFiles([createFile('a.png')]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-a' });
    driver.tick();
    await flushFrames();

    let finish = () => undefined as void;
    const animation = { finished: new Promise<void>((resolve) => (finish = resolve)), cancel: vi.fn() };
    const animate = vi.fn(() => animation as unknown as Animation);
    const originalAnimate = HTMLElement.prototype.animate;

    HTMLElement.prototype.animate = animate;

    try {
      driver.click(driver.removeButton(0)!);
      expect(animate).toHaveBeenCalled();

      driver.host.disabled.set(true);
      driver.tick();
      finish();
      await flushFrames();
      driver.tick();

      expect(animation.cancel).toHaveBeenCalled();
      expect(driver.itemEls().length).toBe(1);
      expect(driver.itemEls()[0]!.style.pointerEvents).toBe('');
      expect(driver.host.value()).toEqual(['uuid-a']);
    } finally {
      HTMLElement.prototype.animate = originalAnimate;
    }
  });

  it('should show a validation-style error with a retry button for failed uploads', () => {
    driver.host.multiple.set(true);
    driver.tick();

    driver.pickFiles([createFile('a.png')]);
    driver.query.httpTesting.expectOne(UPLOAD_URL).flush('nope', { status: 500, statusText: 'Server Error' });
    driver.tick();

    expect(driver.itemStatuses()).toEqual(['error']);
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

describe('DropzoneComponent with localized labels', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });

  it('should announce upload activity through the DROPZONE_LABELS uploading label', () => {
    const driver = mountDropzone(DropzoneLocalizedComponentTestHost);

    driver.host.upload.set(
      createDropzoneUpload<UploadArgs, string>({
        queryCreator: driver.query.createPost<UploadArgs>('/upload'),
        selectValue: (response) => response.uuid,
      }),
    );
    driver.tick();

    driver.pickFiles([createFile()]);

    expect(driver.liveStatus()).toBe('Lade 1 Datei hoch');

    driver.query.httpTesting.expectOne(UPLOAD_URL).flush({ uuid: 'uuid-1' });
    driver.tick();

    expect(driver.liveStatus()).toBe('');

    driver.fixture.destroy();
    driver.query.httpTesting.verify();
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

@Component({
  template: `
    <et-dropzone [(touched)]="touched" [upload]="upload" [errors]="errors" invalid name="attachments">
      <et-label>Attachments</et-label>
      <et-hint>Images up to 5 MB</et-hint>
    </et-dropzone>
  `,
  imports: [DropzoneComponent, HintComponent, LabelDirective],
})
class DropzoneWithErrorTestHost {
  errors = [{ kind: 'required', message: 'Attach at least one file' }];

  touched = signal(true);

  upload: AnyDropzoneUploadConfig<string> = {
    selectValue: (response: unknown) => String(response),
    createUploadHandle: () => {
      throw new Error('the support-region test never uploads');
    },
    deleteIncludesExisting: false,
  };
}

describe('dropzone support region', () => {
  it('should describe the trigger by the rendered error', () => {
    const host = mountControl(DropzoneWithErrorTestHost).nativeElement as HTMLElement;

    expectDescribedByPointsAtErrors(host);
  });
});
