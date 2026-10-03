import { Component, signal } from '@angular/core';
import { QueryTestSetup } from '@ethlete/query/testing';
import '../../../../test-helpers';
import { MountedDropzoneDriver, mountDropzone } from '../../testing/dropzone-driver';
import { DEFAULT_DROPZONE_LABELS } from '../dropzone-labels';
import { formatFileSize, isFileAccepted } from './dropzone-entry';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './dropzone-upload';
import { DropzoneFileRejection } from './dropzone-validation';
import { DropzoneDirective } from './dropzone.directive';

type UploadArgs = { response: { uuid: string }; body: FormData };

const UPLOAD_URL = 'https://api.test.com/upload';

const createFile = (name: string, size: number, type = 'image/png') => new File([new Uint8Array(size)], name, { type });

const createUploadConfig = (setup: QueryTestSetup) =>
  createDropzoneUpload<UploadArgs, string>({
    queryCreator: setup.createPost<UploadArgs>('/upload'),
    selectValue: (response) => response.uuid,
  });

@Component({
  template: `
    <div
      [(value)]="value"
      [upload]="upload()!"
      [multiple]="true"
      [disabled]="disabled()"
      [accept]="accept()"
      [maxFileSize]="maxFileSize()"
      [minFileSize]="minFileSize()"
      (filesReject)="rejections.push($event)"
      etDropzone
    ></div>
  `,
  imports: [DropzoneDirective],
})
class DropzoneLimitsHost {
  upload = signal<AnyDropzoneUploadConfig<string> | null>(null);
  value = signal<string | string[] | null>(null);
  disabled = signal(false);
  accept = signal('');
  maxFileSize = signal<number | string | undefined>(undefined);
  minFileSize = signal<number | string | undefined>(undefined);

  rejections: DropzoneFileRejection[][] = [];
}

describe('DropzoneDirective size limits', () => {
  let driver: MountedDropzoneDriver<DropzoneLimitsHost>;

  beforeEach(() => {
    driver = mountDropzone(DropzoneLimitsHost, { upload: (query) => createUploadConfig(query) });
  });

  afterEach(() => {
    driver.fixture.destroy();
  });

  const select = (...files: File[]) => {
    driver.dropzone.selectFiles(files);
    driver.tick();
  };

  const reasons = () => driver.host.rejections.flat().map((rejection) => rejection.reason);
  const uploads = () => driver.query.httpTesting.match(UPLOAD_URL).length;

  it('accepts a file of exactly maxFileSize and rejects one byte more', () => {
    driver.host.maxFileSize.set(10);
    driver.tick();

    select(createFile('fits.png', 10), createFile('over.png', 11));

    expect(reasons()).toEqual(['maxFileSize']);
    expect(uploads()).toBe(1);
  });

  it('accepts a file of exactly minFileSize and rejects one byte less', () => {
    driver.host.minFileSize.set(10);
    driver.tick();

    select(createFile('fits.png', 10), createFile('under.png', 9));

    expect(reasons()).toEqual(['minFileSize']);
    expect(uploads()).toBe(1);
  });

  it('rejects an empty file with a minFileSize of 1', () => {
    driver.host.minFileSize.set(1);
    driver.tick();

    select(createFile('empty.png', 0));

    expect(reasons()).toEqual(['minFileSize']);
    expect(uploads()).toBe(0);
  });

  it('reads a maxFileSize of 0 as a limit, not as no limit', () => {
    driver.host.maxFileSize.set(0);
    driver.tick();

    select(createFile('empty.png', 0), createFile('one.png', 1));

    expect(reasons()).toEqual(['maxFileSize']);
    expect(uploads()).toBe(1);
  });

  it.each([
    ['an empty string', ''],
    ['undefined', undefined],
  ])('applies no limit for a maxFileSize of %s', (_, maxFileSize) => {
    driver.host.maxFileSize.set(maxFileSize);
    driver.tick();

    select(createFile('big.png', 1000));

    expect(reasons()).toEqual([]);
    expect(uploads()).toBe(1);
  });

  it('parses a numeric string limit', () => {
    driver.host.maxFileSize.set('5');
    driver.tick();

    select(createFile('big.png', 6));

    expect(reasons()).toEqual(['maxFileSize']);
  });

  it('checks the type before the size', () => {
    driver.host.accept.set('image/*');
    driver.host.maxFileSize.set(1);
    driver.tick();

    select(createFile('doc.pdf', 100, 'application/pdf'));

    expect(reasons()).toEqual(['accept']);
  });

  it('ignores an empty selection without touching the control', () => {
    select();

    expect(driver.dropzone.touched()).toBe(false);
    expect(driver.dropzone.lastRejections()).toEqual([]);
  });

  it('ignores a selection while disabled', () => {
    driver.host.disabled.set(true);
    driver.host.maxFileSize.set(1);
    driver.tick();

    select(createFile('big.png', 10));

    expect(driver.host.rejections).toEqual([]);
    expect(uploads()).toBe(0);
  });
});

describe('isFileAccepted edge cases', () => {
  it('accepts everything for an accept of only commas and whitespace', () => {
    expect(isFileAccepted(createFile('a.bin', 1, ''), ' , ,')).toBe(true);
  });

  it('matches case-insensitively and trims each rule', () => {
    expect(isFileAccepted(createFile('PHOTO.PNG', 1, 'image/png'), ' .png , image/jpeg')).toBe(true);
    expect(isFileAccepted(createFile('photo.jpg', 1, 'image/jpeg'), ' IMAGE/JPEG ')).toBe(true);
  });

  it('rejects a file without a type against a wildcard type', () => {
    expect(isFileAccepted(createFile('photo', 1, ''), 'image/*')).toBe(false);
  });

  it('matches a multi-part extension', () => {
    expect(isFileAccepted(createFile('backup.tar.gz', 1, ''), '.tar.gz')).toBe(true);
    expect(isFileAccepted(createFile('backup.gz', 1, ''), '.tar.gz')).toBe(false);
  });
});

describe('formatFileSize edge cases', () => {
  it('formats zero and sub-kilobyte sizes in bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('switches unit exactly at 1024', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  it('carries a size that rounds up to 1024 into the next unit', () => {
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024 - 1)).toBe('1 GB');
  });

  it('stays in terabytes beyond the largest unit', () => {
    expect(formatFileSize(1024 ** 5)).toBe('1024 TB');
  });

  it('names the formatted limit in the default rejection label', () => {
    expect(DEFAULT_DROPZONE_LABELS.fileTooLarge('a.png', 5 * 1024 * 1024 - 1)).toBe('"a.png" is too large (max 5 MB).');
  });
});
