import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { injectRenderer, signalElementDimensions } from '@ethlete/core';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
import { AutosizeBounds, computeAutosizeBlockSize, readTextareaStyleMetrics } from './internals/textarea-autosize';

export const TEXTAREA_RESIZE_MODES = {
  NONE: 'none',
  VERTICAL: 'vertical',
} as const;

export type TextareaResizeMode = (typeof TEXTAREA_RESIZE_MODES)[keyof typeof TEXTAREA_RESIZE_MODES];

@Directive({
  selector: '[etTextarea]',
})
export class TextareaDirective implements FormValueControl<string>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();

  public value = model('');
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- form-field hidden state deliberately mirrors the native attribute
  public hidden = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  public placeholder = input('');
  public autocomplete = input('');
  public rows = input(3);
  public autosize = input(true);
  public minRows = input<number | null>(null);
  public maxRows = input<number | null>(null);
  /** Only applied when `autosize` is off; an autosizing textarea is never manually resizable. */
  public resize = input<TextareaResizeMode>(TEXTAREA_RESIZE_MODES.VERTICAL);

  public shouldDisplayError = computed(() => this.touched() && this.invalid());
  public hasValue = computed(() => this.value().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.TEXTAREA);
  public focused = signal(false);

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  public effectiveResize = computed(() => (this.autosize() ? TEXTAREA_RESIZE_MODES.NONE : this.resize()));

  /** @internal */
  public focusTarget = signal<HTMLElement | null>(null);

  /**
   * The native textarea element this directive controls. Set automatically when
   * the directive is placed on a `<textarea>` element; otherwise the hosting
   * component registers it.
   */
  public nativeControl = signal<HTMLTextAreaElement | null>(null);

  private nativeControlDimensions = signalElementDimensions(this.nativeControl);

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

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

  public activate() {
    if (this.disabled()) return;

    this.focusTarget()?.focus();
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
