import { Directive, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { TAG_INPUT_ERROR_CODES } from '../tag-input-errors';
import { separatorPattern } from './internals/separator-pattern';
import { TagInputDirective } from './tag-input.directive';

/** The text field of a tag input - commits its text as a tag on separators and blur. */
@Directive({
  selector: 'input[etTagInputField]',
  exportAs: 'etTagInputField',
  host: {
    autocomplete: 'off',
    '[attr.placeholder]': 'tagInput?.effectivePlaceholder() || null',
    '[attr.aria-required]': 'tagInput?.required() || null',
    '[attr.aria-invalid]': 'tagInput?.shouldDisplayError() || null',
    '[attr.aria-describedby]': 'tagInput?.describedBy() || null',
    '[attr.aria-label]': 'tagInput?.ariaLabel() || null',
    '[attr.aria-labelledby]': 'tagInput?.labelId() || null',
    '[disabled]': 'tagInput?.disabled() || false',
    '[readOnly]': 'isReadOnly()',
    '(input)': 'handleInput()',
    '(keydown)': 'handleKeydown($event)',
    '(paste)': 'handlePaste($event)',
    '(focus)': 'handleFocus()',
    '(blur)': 'handleBlur()',
  },
})
export class TagInputFieldDirective {
  protected tagInput = inject(TagInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private pendingText = signal('');

  private isFull = computed(() => this.tagInput?.isFull() ?? false);

  /**
   * A full field locks - but never while it still holds text, or text a full input rejected would
   * have no keyboard way out: the chips' remove buttons are not tab stops.
   */
  protected isReadOnly = computed(() => this.tagInput?.readonly() || (this.isFull() && !this.pendingText()));

  constructor() {
    registerSingleton(this.tagInput?.registeredField, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tagInput) {
          throw new RuntimeError(
            TAG_INPUT_ERROR_CODES.FIELD_OUTSIDE_TAG_INPUT,
            '[TagInputFieldDirective] etTagInputField must be placed inside an [etTagInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public focus(options?: FocusOptions) {
    this.elementRef.nativeElement.focus(options ?? { preventScroll: true });
  }

  /** Commits the pending text as a tag (if any) and clears the field. */
  public commitPending() {
    const element = this.elementRef.nativeElement;

    if (!element.value) {
      return;
    }

    if (this.tagInput?.add(element.value) ?? false) {
      this.writeField('');
    }
  }

  protected handleInput() {
    const tagInput = this.tagInput;
    const element = this.elementRef.nativeElement;

    if (!tagInput) {
      return;
    }

    this.pendingText.set(element.value);

    const parts = element.value.split(separatorPattern(tagInput.characterSeparators()));
    const remainder = parts.pop() ?? '';

    if (!parts.length) {
      return;
    }

    const rejected = parts.filter((part) => part && !tagInput.add(part));

    this.writeField([...rejected, remainder].filter(Boolean).join(' '));
  }

  protected handleKeydown(event: KeyboardEvent) {
    const tagInput = this.tagInput;
    const element = this.elementRef.nativeElement;

    if (!tagInput || event.isComposing) {
      return;
    }

    if (tagInput.keySeparators().includes(event.key)) {
      // only swallow the key when there is text to commit - an empty Enter should
      // keep its default behavior (e.g. submitting the surrounding form)
      if (element.value) {
        event.preventDefault();
        this.commitPending();
      }

      return;
    }

    if (event.key === 'Backspace' && !element.value) {
      event.preventDefault();
      tagInput.removeLast();
    }
  }

  protected handlePaste(event: ClipboardEvent) {
    const tagInput = this.tagInput;
    const text = event.clipboardData?.getData('text/plain');

    if (!tagInput || !text) {
      return;
    }

    const separators = tagInput.characterSeparators();

    if (!separators.length && !text.includes('\n')) {
      return;
    }

    const element = this.elementRef.nativeElement;
    const selectionStart = element.selectionStart ?? element.value.length;
    const selectionEnd = element.selectionEnd ?? selectionStart;
    const merged = element.value.slice(0, selectionStart) + text + element.value.slice(selectionEnd);

    const parts = merged.split(separatorPattern(separators));

    if (parts.length < 2) {
      return;
    }

    event.preventDefault();

    const rejected = parts.filter((part) => part.trim() && !tagInput.add(part));

    this.writeField(rejected.map((part) => part.trim()).join(' '));
  }

  protected handleFocus() {
    this.tagInput?.focused.set(true);
  }

  protected handleBlur() {
    // leaving the field keeps what was typed - as a tag
    this.commitPending();
    this.tagInput?.focused.set(false);
    this.tagInput?.touched.set(true);
  }

  private writeField(value: string) {
    this.elementRef.nativeElement.value = value;
    this.pendingText.set(value);
  }
}
