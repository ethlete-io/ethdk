import { Component, signal } from '@angular/core';
import { QueryTestSetup } from '@ethlete/query/testing';
import '../../../../test-helpers';
import { MountedDropzoneDriver, mountDropzone } from '../../testing/dropzone-driver';
import { DEFAULT_DROPZONE_LABELS } from '../dropzone-labels';
import { formatFileSize, isFileAccepted } from './dropzone-entry';
import { AnyDropzoneUploadConfig, createDropzoneUpload } from './dropzone-upload';
import { DropzoneFileRejection } from './dropzone-validation';
import { DropzoneDirective } from './dropzone.directive';

const imageSizes = vi.hoisted(() => new Map<string, { width: number; height: number }>());

vi.mock('./internals/dropzone-image-size', async () => {
  const { from } = await import('rxjs');

  return {
    readDropzoneImageSize: (file: File) => from(Promise.resolve(imageSizes.get(file.name) ?? null)),
  };
});

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
      [minImageWidth]="minImageWidth()"
      [minImageHeight]="minImageHeight()"
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
  minImageWidth = signal<number | undefined>(undefined);
  minImageHeight = signal<number | undefined>(undefined);

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

  describe('minimum image size', () => {
    beforeEach(() => {
      imageSizes.set('small.png', { width: 99, height: 400 });
      imageSizes.set('exact.png', { width: 100, height: 50 });
      imageSizes.set('flat.png', { width: 400, height: 49 });
      driver.host.minImageWidth.set(100);
      driver.host.minImageHeight.set(50);
      driver.tick();
    });

    afterEach(() => imageSizes.clear());

    const settle = () =>
      vi.waitFor(() => {
        driver.tick();
        expect(driver.dropzone.touched()).toBe(true);
        expect(driver.host.rejections.length + driver.dropzone.entries().length).toBeGreaterThan(0);
      });

    it('rejects an image below the minimum width or height in one batch, before any upload', async () => {
      select(createFile('small.png', 4), createFile('exact.png', 4), createFile('flat.png', 4));

      expect(uploads()).toBe(0);

      await settle();

      expect(driver.host.rejections).toHaveLength(1);
      expect(driver.host.rejections[0]!.map(({ file, reason }) => [file.name, reason])).toEqual([
        ['small.png', 'imageTooSmall'],
        ['flat.png', 'imageTooSmall'],
      ]);
      expect(driver.query.httpTesting.match(UPLOAD_URL)).toHaveLength(1);
    });

    it('keeps the sync rejections in the same batch as the too-small images', async () => {
      driver.host.maxFileSize.set(10);
      driver.tick();

      select(createFile('small.png', 4), createFile('big.png', 11));
      await settle();

      expect(driver.host.rejections).toEqual([
        [expect.objectContaining({ reason: 'maxFileSize' }), expect.objectContaining({ reason: 'imageTooSmall' })],
      ]);
      expect(uploads()).toBe(0);
    });

    it('skips the check for files that are not raster images', () => {
      select(createFile('doc.pdf', 4, 'application/pdf'));

      expect(reasons()).toEqual([]);
      expect(uploads()).toBe(1);
    });

    it('drops the result of a selection that a newer one replaced', async () => {
      driver.dropzone.selectFiles([createFile('small.png', 4)]);
      driver.dropzone.selectFiles([createFile('exact.png', 4)]);
      await settle();

      expect(reasons()).toEqual([]);
      expect(uploads()).toBe(1);
    });

    it('names the minimum in the rejection label', () => {
      expect(DEFAULT_DROPZONE_LABELS.imageTooSmall('a.png', { width: 100, height: 50 })).toBe(
        '"a.png" is too small (min 100 × 50 px).',
      );
      expect(DEFAULT_DROPZONE_LABELS.imageTooSmall('a.png', { width: 100, height: undefined })).toBe(
        '"a.png" is too small (min 100 px wide).',
      );
    });
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
