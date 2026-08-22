import { DestroyRef, Directive, booleanAttribute, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  AccessibleNameControlDirective,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
} from '../../form-field/headless';
import { TagInputFieldDirective } from './tag-input-field.directive';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';

const defaultNormalizeTag = (raw: string) => {
  const trimmed = raw.trim();

  return trimmed.length ? trimmed : null;
};

@Directive({
  selector: '[etTagInput]',
  exportAs: 'etTagInput',
  host: {
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class TagInputDirective
  extends AccessibleNameControlDirective
  implements FormValueControl<string[]>, FormFieldControl
{
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public value = model<string[]>([]);
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');

  /**
   * The bound field's `maxLength()` limit - for an array value that is the maximum number of tags.
   * Signal forms binds it automatically because this input exists, so `<et-counter />` picks the
   * limit up from the schema. Display only: the tag input does not refuse tags past it, so the
   * validator is still the thing that reports the violation.
   */
  public maxLength = input<number | undefined>(undefined);

  /**
   * True while an async validator is in flight for the bound field - bound automatically by signal
   * forms because this input exists. The field shell surfaces it as its busy state.
   */
  public pending = input(false, { transform: booleanAttribute });

  public placeholder = input('');
  /** Field placeholder shown while `mixed` is set. */
  public mixedLabel = input<string | null>(null);

  /**
   * What commits the pending text as a tag: multi-character entries are key names
   * (`'Enter'`), single characters commit as soon as they are typed (and split pastes).
   */
  public separators = input<string[]>(['Enter', ',']);
  public allowDuplicates = input(false, { transform: booleanAttribute });
  /** Maps raw text to the stored tag - return `null` to reject. Defaults to trimming. */
  public normalizeTag = input<(raw: string) => string | null>(defaultNormalizeTag);
  public maxTags = input<number | undefined>(undefined);

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  /** The raw value normalized to the tags the control currently shows. Mixed has no effective tags. */
  public effectiveValues = computed<readonly string[]>(() => (this.mixed() ? [] : this.value()));

  public hasValue = computed(() => this.mixed() || this.effectiveValues().length > 0);

  /** The placeholder the text field currently shows - `mixedLabel` while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TAG_INPUT);
  public focused = signal(false);

  /** @internal */
  public registeredField = signal<TagInputFieldDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());

  /** True once `maxTags` is reached - further adds are ignored. Mixed counts as no tags. */
  public isFull = computed(() => {
    const maxTags = this.maxTags();

    return maxTags !== undefined && this.effectiveValues().length >= maxTags;
  });

  /** @internal Single-character separators - they split pastes and commit while typing. */
  public characterSeparators = computed(() => this.separators().filter((separator) => separator.length === 1));
  /** @internal Multi-character separators are key names (e.g. `'Enter'`). */
  public keySeparators = computed(() => this.separators().filter((separator) => separator.length > 1));

  constructor() {
    super();

    mountTextFieldShellStyles();

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));
  }

  public activate() {
    this.focus();
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus(options);
  }

  /**
   * Normalizes and appends a tag. Returns whether it was added. While mixed, the first
   * added tag REPLACES the hidden raw value (starting a fresh set) and resolves mixed.
   */
  public add(raw: string) {
    if (!this.interactive() || this.isFull()) {
      return false;
    }

    const tag = this.normalizeTag()(raw);

    if (tag === null) {
      return false;
    }

    // while mixed the effective set is empty - duplicates are checked against the fresh
    // set the user is building, never against the hidden raw value
    const current = this.effectiveValues();

    if (!this.allowDuplicates() && current.includes(tag)) {
      return false;
    }

    this.value.set([...current, tag]);
    this.mixed.set(false);

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

    const index = this.effectiveValues().lastIndexOf(tag);

    if (index !== -1) {
      this.removeAt(index);
    }
  }

  public removeAt(index: number) {
    // while mixed there is no visible chip to delete - a removal (e.g. Backspace on the
    // empty field) must not touch the hidden raw tags of every edited record
    if (!this.interactive() || this.mixed()) {
      return;
    }

    this.value.set(this.value().filter((_, candidate) => candidate !== index));
  }

  public removeLast() {
    this.removeAt(this.effectiveValues().length - 1);
  }
}
