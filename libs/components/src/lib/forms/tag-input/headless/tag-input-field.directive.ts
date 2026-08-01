import { Directive, ElementRef, afterNextRender, computed, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { TAG_INPUT_ERROR_CODES } from '../tag-input-errors';
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
    '[attr.aria-labelledby]': 'tagInput?.labelId() || null',
    '[disabled]': 'tagInput?.disabled() || false',
    '[readOnly]': 'tagInput?.readonly() || isFull()',
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

  protected isFull = computed(() => this.tagInput?.isFull() ?? false);

  constructor() {
    registerSingleton(this.tagInput?.registeredField, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tagInput) {
          throw new RuntimeError(
            TAG_INPUT_ERROR_CODES.FIELD_OUTSIDE_TAG_INPUT,
            '[TagInputFieldDirective] etTagInputField must be placed inside an [etTagInput] element.',
          );
        }
      });
    }
  }

  /** @internal */
  public focus() {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  /** Commits the pending text as a tag (if any) and clears the field. */
  public commitPending() {
    const element = this.elementRef.nativeElement;

    if (!element.value) {
      return;
    }

    if (this.tagInput?.add(element.value) ?? false) {
      element.value = '';
    }
  }

  protected handleInput() {
    const tagInput = this.tagInput;
    const element = this.elementRef.nativeElement;

    if (!tagInput) {
      return;
    }

    // typing a single-character separator commits the text before it
    const separators = tagInput.characterSeparators();
    const value = element.value;
    const lastChar = value.at(-1);

    if (lastChar !== undefined && separators.includes(lastChar)) {
      const pending = value.slice(0, -1);

      element.value = pending;

      if (pending && tagInput.add(pending)) {
        element.value = '';
      }
    }
  }

  protected handleKeydown(event: KeyboardEvent) {
    const tagInput = this.tagInput;
    const element = this.elementRef.nativeElement;

    if (!tagInput) {
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

    const pattern = new RegExp(
      `[\\n${separators.map((separator) => separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}]`,
    );
    const parts = text.split(pattern);

    if (parts.length < 2) {
      return;
    }

    event.preventDefault();
    tagInput.addAll(parts);
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
}
