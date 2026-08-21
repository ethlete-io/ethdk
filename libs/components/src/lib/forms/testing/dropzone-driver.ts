import { Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { textOf, tick } from '../../testing/driver-core';
import { DropzoneDirective } from '../dropzone/headless';

const DROPZONE = '[etDropzone]';
const ITEM = '.et-dropzone-item';

const DROPZONE_TYPE = DropzoneDirective as Type<DropzoneDirective<string>>;

/** jsdom has no `DataTransfer`, so the dragged payload is faked onto the event. */
const dragEvent = (type: string, files: File[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });

  return event;
};

/**
 * The dropzone in both its shapes: the bare directive and the `et-dropzone` component. The
 * directive element is the one carrying `[etDropzone]`, or the fixture's host element when the
 * component wears the directive as a host directive and no attribute is there to match.
 */
export const createDropzoneDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, DROPZONE_TYPE, options);

  const dropzoneEl = () => base.query(DROPZONE) ?? base.element();
  const nativeInput = () => base.query<HTMLInputElement>('.et-dropzone-native-input')!;
  const itemEls = () => base.queryAll(ITEM);
  const itemChild = (index: number, selector: string) => itemEls()[index]!.querySelector<HTMLElement>(selector);

  return {
    ...base,
    dropzone: base.control,

    attr: (name: string) => dropzoneEl().getAttribute(name),
    drag: (type: string, files: File[] = []) => {
      dropzoneEl().dispatchEvent(dragEvent(type, files));
      tick();
    },

    nativeInput,
    triggerEl: () => base.query<HTMLButtonElement>('.et-dropzone-trigger')!,
    /** Picks files the way the file dialog does: jsdom has no `FileList`, so `files` is faked. */
    pickFiles: (files: File[]) => {
      const input = nativeInput();

      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change'));
      tick();
    },

    areaEl: () => base.query('.et-dropzone-area')!,
    previewEl: () => base.query('.et-dropzone-preview'),
    previewImage: () => base.query<HTMLImageElement>('.et-dropzone-preview-image'),
    previewName: () => base.text('.et-dropzone-preview .et-dropzone-entry-name'),
    listEl: () => base.query('.et-dropzone-list'),

    itemEls,
    itemStatuses: () => itemEls().map((item) => item.getAttribute('data-status')),
    itemProgressBar: (index: number) => itemChild(index, 'et-progress-bar'),
    itemInternalErrors: (index: number) => itemChild(index, '.et-dropzone-internal-errors'),
    removeButton: (index: number) => itemChild(index, '.et-dropzone-remove-button'),
    retryButton: (index: number) => itemChild(index, '.et-dropzone-retry-button'),

    liveStatus: () => base.text('.et-dropzone-live-status'),
    internalErrors: () => base.query('.et-dropzone-internal-errors'),
    internalErrorsText: () => textOf(base.query('.et-dropzone-internal-errors')),
    errorsText: () => textOf(base.query('.et-dropzone-errors')),
  };
};

export type DropzoneDriver<T> = ReturnType<typeof createDropzoneDriver<T>>;
export type MountedDropzoneDriver<T> = DropzoneDriver<T> & { query: QueryTestSetup };

/**
 * Mounts a dropzone with a query test setup in place - the upload config needs one, and it has to
 * exist before the component is created.
 */
export const mountDropzone = <T>(component: Type<T>, options: ControlDriverOptions = {}) => {
  let query!: QueryTestSetup;
  const fixture = mountControl(component, [], () => {
    query = setupQueryTest();
  });

  return { ...createDropzoneDriver(fixture, options), query };
};
