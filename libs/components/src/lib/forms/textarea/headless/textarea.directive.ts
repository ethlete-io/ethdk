import {
  booleanAttribute,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { injectRenderer, injectStyleManager, signalElementDimensions } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, TextFieldControlDirective } from '../../form-field/headless';
import {
  AutosizeBounds,
  computeAutosizeBlockSize,
  readTextareaStyleMetrics,
  supportsNativeAutosize,
} from './internals/textarea-autosize';
import { FormFieldTextareaStylesComponent } from '../../form-field/form-field-textarea-styles.component';
import { TextareaAutosizeStylesComponent } from '../textarea-autosize-styles.component';

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
  public rows = input(3, { transform: numberAttribute });
  public autosize = input(true, { transform: booleanAttribute });
  public minRows = input<number | null>(null);
  public maxRows = input<number | null>(null);
  /** Only applied when `autosize` is off; an autosizing textarea is never manually resizable. */
  public resize = input<TextareaResizeMode>(TEXTAREA_RESIZE_MODES.VERTICAL);

  public hasValue = computed(() => this.mixed() || this.value().length > 0);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXTAREA);

  /** The text the native textarea renders - empty while mixed so the raw value never reaches the DOM. */
  public displayValue = computed(() => (this.mixed() ? '' : this.value()));

  /** The placeholder the native textarea renders - `mixedLabel` overrides the consumer placeholder while mixed. */
  public effectivePlaceholder = computed(() => (this.mixed() ? this.resolvedMixedLabel() : this.placeholder()));

  public effectiveResize = computed(() => (this.autosize() ? TEXTAREA_RESIZE_MODES.NONE : this.resize()));

  /**
   * The native textarea element this directive controls. Set automatically when
   * the directive is placed on a `<textarea>` element; otherwise the hosting
   * component registers it.
   */
  public nativeControl = signal<HTMLTextAreaElement | null>(null);

  private nativeAutosize = supportsNativeAutosize();

  private autosizeMinRows = computed(() => this.minRows() ?? this.rows());

  private autosizeMaxBlockSize = computed(() => {
    const maxRows = this.maxRows();

    return maxRows === null ? null : `calc(${maxRows} * 1lh)`;
  });

  // Passing `nativeControl` here instead would attach a ResizeObserver to every textarea that
  // does not need one - only the measurement path below reads a width.
  private measuredControl = computed(() => (this.nativeAutosize ? null : this.nativeControl()));

  private nativeControlDimensions = signalElementDimensions(this.measuredControl);

  constructor() {
    super();
    const styleManager = injectStyleManager();
    styleManager.mount(FormFieldTextareaStylesComponent);
    styleManager.mount(TextareaAutosizeStylesComponent);

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

      const autosize = this.autosize();
      const minRows = this.autosizeMinRows();
      const maxBlockSize = this.autosizeMaxBlockSize();

      untracked(() => {
        this.renderer.setDataAttributes(textarea, { 'et-textarea-autosize': autosize ? '' : null });
        this.renderer.setCssProperties(textarea, {
          '--et-textarea-min-rows': autosize ? `${minRows}` : null,
          '--et-textarea-max-block-size': autosize ? maxBlockSize : null,
        });
      });
    });

    effect(() => {
      // Reading this first keeps the effect dependency-free where the browser autosizes, so it
      // runs once and never measures again.
      if (this.nativeAutosize) {
        return;
      }

      const textarea = this.nativeControl();

      if (!textarea) {
        return;
      }

      if (!this.autosize()) {
        untracked(() => this.renderer.removeStyle(textarea, 'blockSize'));

        return;
      }

      // size against what is actually rendered - while mixed that is the empty masked display,
      // never the hidden raw value (resizeToFit would otherwise write it into the DOM)
      const value = this.displayValue();
      const bounds: AutosizeBounds = { minRows: this.autosizeMinRows(), maxRows: this.maxRows() };
      const inlineSize = this.nativeControlDimensions()?.client?.width ?? 0;

      // A collapsed/unrendered textarea cannot be measured; the dimensions signal
      // re-triggers once it becomes visible (and on every inline-size change).
      if (inlineSize === 0) {
        return;
      }

      untracked(() => this.resizeToFit(textarea, { bounds, value }));
    });
  }

  /**
   * @internal Routes a user edit from the native textarea into the model. Typing is the commit
   * over a mixed state: the first edit that produces content replaces the raw value and
   * resolves `mixed`; an edit that leaves the textarea empty keeps both untouched.
   */
  public syncFromNativeInput(textareaElement: HTMLTextAreaElement) {
    if (this.mixed()) {
      if (!textareaElement.value) {
        return;
      }

      this.mixed.set(false);
    }

    this.value.set(textareaElement.value);
  }

  private resizeToFit(textarea: HTMLTextAreaElement, { bounds, value }: { bounds: AutosizeBounds; value: string }) {
    // The value model can change before the template binding has flushed to the
    // DOM - measure against the model, not a stale native value.
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
