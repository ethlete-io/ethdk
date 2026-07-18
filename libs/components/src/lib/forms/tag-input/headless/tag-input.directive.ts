import { DestroyRef, Directive, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { TagInputFieldDirective } from './tag-input-field.directive';

const defaultNormalizeTag = (raw: string) => {
  const trimmed = raw.trim();

  return trimmed.length ? trimmed : null;
};

@Directive({
  selector: '[etTagInput]',
  exportAs: 'etTagInput',
  host: {
    '[attr.data-disabled]': 'disabled() || null',
  },
})
export class TagInputDirective implements FormValueControl<string[]>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<string[]>([]);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /**
   * What commits the pending text as a tag: multi-character entries are key names
   * (`'Enter'`), single characters commit as soon as they are typed (and split pastes).
   */
  public separators = input<string[]>(['Enter', ',']);
  public allowDuplicates = input(false);
  /** Maps raw text to the stored tag — return `null` to reject. Defaults to trimming. */
  public normalizeTag = input<(raw: string) => string | null>(defaultNormalizeTag);
  public maxTags = input<number | undefined>(undefined);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TAG_INPUT);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredField = signal<TagInputFieldDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  /** True once `maxTags` is reached — further adds are ignored. */
  public isFull = computed(() => {
    const maxTags = this.maxTags();

    return maxTags !== undefined && this.value().length >= maxTags;
  });

  /** @internal Single-character separators — they split pastes and commit while typing. */
  public characterSeparators = computed(() => this.separators().filter((separator) => separator.length === 1));
  /** @internal Multi-character separators are key names (e.g. `'Enter'`). */
  public keySeparators = computed(() => this.separators().filter((separator) => separator.length > 1));

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus();
  }

  /** Normalizes and appends a tag. Returns whether it was added. */
  public add(raw: string) {
    if (!this.interactive() || this.isFull()) {
      return false;
    }

    const tag = this.normalizeTag()(raw);

    if (tag === null) {
      return false;
    }

    if (!this.allowDuplicates() && this.value().includes(tag)) {
      return false;
    }

    this.value.set([...this.value(), tag]);

    return true;
  }

  /** Adds several raw values at once (a paste split by separators). */
  public addAll(raws: string[]) {
    for (const raw of raws) {
      this.add(raw);
    }
  }

  public remove(tag: string) {
    if (!this.interactive()) {
      return;
    }

    const index = this.value().lastIndexOf(tag);

    if (index !== -1) {
      this.removeAt(index);
    }
  }

  public removeAt(index: number) {
    if (!this.interactive()) {
      return;
    }

    this.value.set(this.value().filter((_, candidate) => candidate !== index));
  }

  public removeLast() {
    this.removeAt(this.value().length - 1);
  }
}
