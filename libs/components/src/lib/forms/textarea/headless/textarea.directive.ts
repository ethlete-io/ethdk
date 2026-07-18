import { computed, Directive, effect, ElementRef, inject, input, model, signal, untracked } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { injectRenderer, signalElementDimensions } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import { AutosizeBounds, computeAutosizeBlockSize, readTextareaStyleMetrics } from './internals/textarea-autosize';

export const TEXTAREA_RESIZE_MODES = {
  NONE: 'none',
  VERTICAL: 'vertical',
} as const;

export type TextareaResizeMode = (typeof TEXTAREA_RESIZE_MODES)[keyof typeof TEXTAREA_RESIZE_MODES];

@Directive({
  selector: '[etTextarea]',
})
export class TextareaDirective extends TextFieldControlDirective implements FormValueControl<string> {
  private renderer = injectRenderer();

  public value = model('');

  public placeholder = input('');
  public autocomplete = input('');
  public rows = input(3);
  public autosize = input(true);
  public minRows = input<number | null>(null);
  public maxRows = input<number | null>(null);
  /** Only applied when `autosize` is off; an autosizing textarea is never manually resizable. */
  public resize = input<TextareaResizeMode>(TEXTAREA_RESIZE_MODES.VERTICAL);

  public hasValue = computed(() => this.value().length > 0);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXTAREA);

  public effectiveResize = computed(() => (this.autosize() ? TEXTAREA_RESIZE_MODES.NONE : this.resize()));

  /**
   * The native textarea element this directive controls. Set automatically when
   * the directive is placed on a `<textarea>` element; otherwise the hosting
   * component registers it.
   */
  public nativeControl = signal<HTMLTextAreaElement | null>(null);

  private nativeControlDimensions = signalElementDimensions(this.nativeControl);

  constructor() {
    super();

    const hostRef = inject<ElementRef<HTMLElement | null>>(ElementRef);
    const hostElement = hostRef.nativeElement;

    if (hostElement?.tagName === 'TEXTAREA') {
      this.nativeControl.set(hostElement as HTMLTextAreaElement);
      this.focusTarget.set(hostElement);
    }

    effect(() => {
      const textarea = this.nativeControl();

      if (!textarea) {
        return;
      }

      if (!this.autosize()) {
        untracked(() => this.renderer.removeStyle(textarea, 'blockSize'));

        return;
      }

      const value = this.value();
      const bounds: AutosizeBounds = { minRows: this.minRows() ?? this.rows(), maxRows: this.maxRows() };
      const inlineSize = this.nativeControlDimensions()?.client?.width ?? 0;

      // A collapsed/unrendered textarea cannot be measured; the dimensions signal
      // re-triggers once it becomes visible (and on every inline-size change).
      if (inlineSize === 0) {
        return;
      }

      untracked(() => this.resizeToFit(textarea, { bounds, value }));
    });
  }

  private resizeToFit(textarea: HTMLTextAreaElement, { bounds, value }: { bounds: AutosizeBounds; value: string }) {
    // The value model can change before the template binding has flushed to the
    // DOM — measure against the model, not a stale native value.
    if (textarea.value !== value) {
      this.renderer.setProperty(textarea, 'value', value);
    }

    const metrics = readTextareaStyleMetrics(textarea);

    this.renderer.setStyle(textarea, { blockSize: '0' });
    const contentBlockSize = textarea.scrollHeight;

    const blockSize = computeAutosizeBlockSize({ ...metrics, contentBlockSize }, bounds);

    this.renderer.setStyle(textarea, { blockSize: `${blockSize}px` });
  }
}
