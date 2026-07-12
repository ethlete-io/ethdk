import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  EffectRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FORM_FIELD, FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import {
  createExistingDropzoneEntry,
  createFileDropzoneEntry,
  disposeDropzoneEntry,
  DROPZONE_ENTRY_STATUSES,
  DropzoneEntry,
  isFileAccepted,
} from './dropzone-entry';
import { DROPZONE_ERROR_CODES } from './dropzone-errors';
import { AnyDropzoneUploadConfig, createDefaultDropzoneArgs } from './dropzone-upload';
import {
  DROPZONE_FILE_CONSTRAINTS,
  DROPZONE_FILE_REJECTION_REASONS,
  DropzoneFileRejection,
} from './dropzone-validation';

const isValueInControl = <TValue>(entry: DropzoneEntry<TValue>) => {
  const status = entry.status();

  return status === DROPZONE_ENTRY_STATUSES.SUCCESS || status === DROPZONE_ENTRY_STATUSES.EXISTING;
};

const valuesEqual = (a: unknown, b: unknown) => {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }

  return false;
};

@Directive({
  selector: '[etDropzone]',
  host: {
    '[attr.data-drag-over]': 'isDragOver() || null',
    '[attr.data-disabled]': 'disabled() || null',
    '(dragenter)': 'handleDragEnter($event)',
    '(dragover)': 'handleDragOver($event)',
    '(dragleave)': 'handleDragLeave()',
    '(drop)': 'handleDrop($event)',
  },
})
export class DropzoneDirective<TValue = unknown>
  implements FormValueControl<TValue | TValue[] | null>, FormFieldControl
{
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private signalFormField = inject(FORM_FIELD, { optional: true });
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  public value = model<TValue | TValue[] | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  /** The upload workflow configuration. Create it via `createDropzoneUpload()`. */
  public upload = input.required<AnyDropzoneUploadConfig<TValue>>();

  /** Whether multiple files can be uploaded. The control value becomes an array. */
  public multiple = input(false);

  /** Emits all files of a selection that were rejected, with the reason per file. */
  public filesRejected = output<DropzoneFileRejection[]>();

  /** Emits when the upload of an entry succeeded (after the control value was updated). */
  public uploadSucceeded = output<DropzoneEntry<TValue>>();

  /** Emits when the upload of an entry failed. */
  public uploadFailed = output<DropzoneEntry<TValue>>();

  private internalEntries = signal<DropzoneEntry<TValue>[]>([]);
  private internalLastRejections = signal<DropzoneFileRejection[]>([]);
  private dragDepth = signal(0);
  private entryWatchers = new Map<string, EffectRef>();
  private lastSyncedValue: TValue | TValue[] | null = null;
  private hasSyncedValue = false;

  /** All entries currently managed by the dropzone, including uploading and failed ones. */
  public entries = this.internalEntries.asReadonly();

  /** The rejections of the most recent file selection. Reset by the next selection, removal or clear. */
  public lastRejections = this.internalLastRejections.asReadonly();

  /**
   * The file validation channel of the bound form field, if its schema uses the
   * `dropzoneFiles()` rule. Provides the constraints and receives the rejections.
   */
  private fileValidation = computed(() => {
    const state = this.signalFormField?.state();

    return state?.metadata(DROPZONE_FILE_CONSTRAINTS) ?? null;
  });

  /** The `accept` constraint of the bound field's `dropzoneFiles()` rule. Empty accepts everything. */
  public accept = computed(() => this.fileValidation()?.constraints()?.accept ?? '');

  /** Whether a files drag is currently hovering the dropzone. */
  public isDragOver = computed(() => this.dragDepth() > 0);

  public anyUploading = computed(() =>
    this.entries().some((entry) => entry.status() === DROPZONE_ENTRY_STATUSES.UPLOADING),
  );
  public anyFailed = computed(() => this.entries().some((entry) => entry.status() === DROPZONE_ENTRY_STATUSES.ERROR));
  public hasValue = computed(() => this.entries().some(isValueInControl));

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DROPZONE);

  public describedById = computed(() => this.describedBy());
  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => {
      this.formField?.unregisterControl(this);

      for (const entry of this.internalEntries()) {
        this.disposeEntry(entry);
      }
    });

    effect(() => {
      const incoming = this.value();

      untracked(() => this.reconcileValue(incoming));
    });

    if (ngDevMode) {
      afterNextRender(() => {
        const config = this.upload();

        if (typeof config?.queryCreator !== 'function' || typeof config?.selectValue !== 'function') {
          throw new RuntimeError(
            DROPZONE_ERROR_CODES.INVALID_UPLOAD_CONFIG,
            '[DropzoneDirective] The "upload" input must be a config with a "queryCreator" and a "selectValue" function. ' +
              'Create one via createDropzoneUpload({ queryCreator, selectValue, ... }).',
          );
        }
      });
    }
  }

  /** Validates the given files and uploads all accepted ones. */
  public selectFiles(files: FileList | readonly File[]) {
    if (this.disabled()) {
      return;
    }

    const list = Array.from(files);

    if (!list.length) {
      return;
    }

    this.touched.set(true);

    const rejections: DropzoneFileRejection[] = [];
    const accepted: File[] = [];
    const constraints = this.fileValidation()?.constraints();
    const accept = this.accept();
    const multiple = this.multiple();

    const candidates = multiple ? list : list.slice(0, 1);

    for (const file of list.slice(candidates.length)) {
      rejections.push({ file, reason: DROPZONE_FILE_REJECTION_REASONS.MAX_FILES });
    }

    for (const file of candidates) {
      if (accept && !isFileAccepted(file, accept)) {
        rejections.push({ file, reason: DROPZONE_FILE_REJECTION_REASONS.ACCEPT });
      } else if (constraints?.maxFileSize !== undefined && file.size > constraints.maxFileSize) {
        rejections.push({ file, reason: DROPZONE_FILE_REJECTION_REASONS.MAX_FILE_SIZE });
      } else if (constraints?.minFileSize !== undefined && file.size < constraints.minFileSize) {
        rejections.push({ file, reason: DROPZONE_FILE_REJECTION_REASONS.MIN_FILE_SIZE });
      } else {
        accepted.push(file);
      }
    }

    this.setRejections(rejections);

    if (rejections.length) {
      this.filesRejected.emit(rejections);
    }

    if (!accepted.length) {
      return;
    }

    const newEntries = accepted.map((file) => this.createFileEntry(file));

    if (multiple) {
      this.internalEntries.update((entries) => [...entries, ...newEntries]);
    } else {
      for (const entry of this.internalEntries()) {
        this.disposeEntry(entry);
      }

      this.internalEntries.set(newEntries);
      this.syncValue();
    }
  }

  /** Removes an entry. Cancels its upload if it is still in flight. */
  public removeEntry(id: string) {
    if (this.disabled()) {
      return;
    }

    const entry = this.internalEntries().find((item) => item.id === id);

    if (!entry) {
      return;
    }

    const wasInControl = isValueInControl(entry);

    this.internalEntries.update((entries) => entries.filter((item) => item !== entry));
    this.setRejections([]);
    this.disposeEntry(entry);
    this.touched.set(true);

    if (wasInControl) {
      this.syncValue();
    }
  }

  /** Retries the upload of a failed entry with its original request args. */
  public retryEntry(id: string) {
    if (this.disabled()) {
      return;
    }

    const entry = this.internalEntries().find((item) => item.id === id);

    if (!entry || entry.status() !== DROPZONE_ENTRY_STATUSES.ERROR || !entry.query || !entry.args) {
      return;
    }

    entry.query.execute({ args: entry.args });
  }

  /** Removes all entries and resets the control value. */
  public clear() {
    if (!this.internalEntries().length) {
      return;
    }

    for (const entry of this.internalEntries()) {
      this.disposeEntry(entry);
    }

    this.internalEntries.set([]);
    this.setRejections([]);
    this.syncValue();
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.focusTarget()?.focus();
  }

  protected handleDragEnter(event: DragEvent) {
    if (this.disabled() || !event.dataTransfer?.types.includes('Files')) {
      return;
    }

    event.preventDefault();
    this.dragDepth.update((depth) => depth + 1);
  }

  protected handleDragOver(event: DragEvent) {
    if (this.disabled() || !event.dataTransfer?.types.includes('Files')) {
      return;
    }

    event.preventDefault();
  }

  protected handleDragLeave() {
    if (this.disabled()) {
      return;
    }

    this.dragDepth.update((depth) => Math.max(0, depth - 1));
  }

  protected handleDrop(event: DragEvent) {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    this.dragDepth.set(0);

    const files = event.dataTransfer?.files;

    if (files?.length) {
      this.selectFiles(files);
    }
  }

  private setRejections(rejections: DropzoneFileRejection[]) {
    this.internalLastRejections.set(rejections);
    this.fileValidation()?.rejections.set(rejections);
  }

  private createFileEntry(file: File): DropzoneEntry<TValue> {
    const config = this.upload();
    const query = config.queryCreator({ injector: this.injector, silenceMissingWithArgsFeatureError: true });
    const args = (config.createArgs ?? createDefaultDropzoneArgs)(file);
    const entry = createFileDropzoneEntry({ file, query, args, selectValue: config.selectValue });

    let previousStatus: string | null = null;

    const watcher = effect(
      () => {
        const status = entry.status();

        if (status === previousStatus) {
          return;
        }

        previousStatus = status;

        untracked(() => {
          if (status === DROPZONE_ENTRY_STATUSES.SUCCESS) {
            this.syncValue();
            this.uploadSucceeded.emit(entry);
          } else if (status === DROPZONE_ENTRY_STATUSES.ERROR) {
            this.uploadFailed.emit(entry);
          }
        });
      },
      { injector: this.injector },
    );

    this.entryWatchers.set(entry.id, watcher);

    query.execute({ args });

    return entry;
  }

  private disposeEntry(entry: DropzoneEntry<TValue>) {
    this.entryWatchers.get(entry.id)?.destroy();
    this.entryWatchers.delete(entry.id);
    disposeDropzoneEntry(entry);
  }

  private syncValue() {
    const values = this.internalEntries()
      .filter(isValueInControl)
      .map((entry) => entry.value() as TValue);

    const next = this.multiple() ? values : (values[0] ?? null);

    this.lastSyncedValue = next;
    this.hasSyncedValue = true;
    this.value.set(next);
  }

  private reconcileValue(incoming: TValue | TValue[] | null) {
    if (this.hasSyncedValue && valuesEqual(incoming, this.lastSyncedValue)) {
      return;
    }

    this.lastSyncedValue = incoming;
    this.hasSyncedValue = true;

    let values: TValue[];

    if (incoming === null || incoming === undefined) {
      values = [];
    } else if (Array.isArray(incoming)) {
      if (ngDevMode && !this.multiple()) {
        throw new RuntimeError(
          DROPZONE_ERROR_CODES.VALUE_MODE_MISMATCH,
          '[DropzoneDirective] The form control value is an array but the dropzone is in single mode. ' +
            'Set the "multiple" input to true or write a single value.',
        );
      }

      values = this.multiple() ? incoming : incoming.slice(0, 1);
    } else {
      if (ngDevMode && this.multiple()) {
        throw new RuntimeError(
          DROPZONE_ERROR_CODES.VALUE_MODE_MISMATCH,
          '[DropzoneDirective] The form control value is not an array but the dropzone is in multiple mode. ' +
            'Write an array of values or remove the "multiple" input.',
        );
      }

      values = [incoming];
    }

    const currentEntries = this.internalEntries();
    const usedEntries = new Set<DropzoneEntry<TValue>>();
    const valueEntries: DropzoneEntry<TValue>[] = [];

    for (const value of values) {
      const match = currentEntries.find(
        (entry) => !usedEntries.has(entry) && isValueInControl(entry) && entry.value() === value,
      );

      if (match) {
        usedEntries.add(match);
        valueEntries.push(match);
        continue;
      }

      if (ngDevMode && !this.upload().resolveExisting) {
        throw new RuntimeError(
          DROPZONE_ERROR_CODES.MISSING_EXISTING_RESOLVER,
          '[DropzoneDirective] The form control was initialized with a value but the upload config has no "resolveExisting" function. ' +
            'Add one to createDropzoneUpload() so existing values can be displayed.',
        );
      }

      valueEntries.push(createExistingDropzoneEntry({ value, upload: this.upload }));
    }

    const pendingEntries = currentEntries.filter((entry) => !usedEntries.has(entry) && !isValueInControl(entry));
    const droppedEntries = currentEntries.filter((entry) => !usedEntries.has(entry) && isValueInControl(entry));

    for (const entry of droppedEntries) {
      this.disposeEntry(entry);
    }

    const nextEntries = [...valueEntries, ...pendingEntries];
    const changed =
      nextEntries.length !== currentEntries.length ||
      nextEntries.some((entry, index) => entry !== currentEntries[index]);

    if (changed) {
      this.internalEntries.set(nextEntries);
    }
  }
}
