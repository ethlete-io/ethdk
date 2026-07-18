import {
  Directive,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { InputDirective } from '../../input/headless';
import { MASKED_INPUT_ERROR_CODES } from '../masked-input-errors';
import { MASK_VALUE_MODES, MaskSpec, MaskValueMode } from './input-mask.types';
import { advanceCaretPastLiterals, applyMaskEdit, caretForRawCount, renderMaskDisplay } from './internals/mask-engine';
import { compilePatternMask } from './internals/pattern-mask';

/**
 * Layers input masking onto an existing input control — place it on the same element
 * as `et-input` / `input[etInput]`. The native element always shows the masked text;
 * the form value stays raw by default (`maskValueMode`).
 */
@Directive({
  selector: '[etInputMask]',
  exportAs: 'etInputMask',
  host: {
    '(input)': 'handleInput($event)',
  },
})
export class InputMaskDirective {
  private inputDirective = inject(InputDirective, { optional: true });

  /**
   * The mask: a pattern string (`0` digit, `9` optional digit, `a` letter, `*`
   * alphanumeric, `\` escapes, anything else literal) or a `MaskSpec` object
   * (see `createCurrencyMask` / `createIbanMask` / `createCardMask`).
   */
  public mask = input.required<string | MaskSpec>({ alias: 'etInputMask' });

  /** Whether the form value is the raw text (default) or the masked display text. */
  public maskValueMode = input<MaskValueMode>(MASK_VALUE_MODES.RAW);

  /**
   * Renders unfilled slots with this character while the field is focused
   * (e.g. `12-__-____`). Pattern-string masks only.
   */
  public placeholderChar = input<string | null>(null);

  private spec = computed(() => {
    const mask = this.mask();

    return typeof mask === 'string' ? compilePatternMask(mask, { placeholderChar: this.placeholderChar() }) : mask;
  });

  /** The unmasked value, regardless of `maskValueMode`. */
  public rawValue = computed(() => this.spec().toRaw(this.inputDirective?.value() ?? ''));

  /**
   * The raw value as of the last reconciliation — `applyMaskEdit` needs the pre-edit
   * raw to detect edits that only removed formatting. Kept as a plain field (not the
   * model) so event-listener ordering can't pollute it.
   */
  private committedRaw = '';

  /** Caret produced by the last handled edit — consumed once by the display enforcement. */
  private caret: number | null = null;

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.inputDirective) {
          throw new RuntimeError(
            MASKED_INPUT_ERROR_CODES.MASK_OUTSIDE_INPUT,
            'An [etInputMask] must be placed on an input control element (et-input or input[etInput]).',
          );
        }
      });
    }

    // keep the model in its declared shape — this also normalizes programmatic
    // writes (a form reset with masked text, a consumer setting raw text, …)
    effect(() => {
      const inputDirective = this.inputDirective;

      if (!inputDirective) {
        return;
      }

      const spec = this.spec();
      const value = inputDirective.value();
      const raw = spec.toRaw(value);
      const normalized = this.maskValueMode() === MASK_VALUE_MODES.MASKED ? spec.toDisplay(raw) : raw;

      if (normalized !== value) {
        untracked(() => inputDirective.value.set(normalized));
      }
    });

    // the element always shows the masked text. This runs after every render because
    // the hosting component's [value] binding writes the model (raw in raw mode)
    // straight into the element — the rewrite happens before paint, so it's invisible.
    afterRenderEffect(() => {
      const inputDirective = this.inputDirective;
      const element = inputDirective?.nativeControl();

      if (!inputDirective || !element) {
        return;
      }

      const spec = this.spec();
      const raw = this.rawValue();
      const focused = inputDirective.focused();
      const display = renderMaskDisplay({ spec, raw, guide: focused });

      this.committedRaw = raw;

      if (element.value !== display) {
        element.value = display;

        if (focused) {
          const caret =
            this.caret ??
            advanceCaretPastLiterals({ spec, display, caret: caretForRawCount({ spec, display, count: raw.length }) });

          element.setSelectionRange(caret, caret);
        }
      }

      this.caret = null;
    });
  }

  protected handleInput(event: Event) {
    const inputDirective = this.inputDirective;
    const element = inputDirective?.nativeControl();

    if (!inputDirective || !element || event.target !== element) {
      return;
    }

    const spec = this.spec();
    const result = applyMaskEdit({
      spec,
      previousRaw: this.committedRaw,
      text: element.value,
      caret: element.selectionStart ?? element.value.length,
      inputType: (event as InputEvent).inputType,
      // typing implies focus, so the guide display (when available) applies
      guide: true,
    });

    this.committedRaw = result.raw;
    this.caret = result.caret;
    element.value = result.display;
    element.setSelectionRange(result.caret, result.caret);
    inputDirective.value.set(
      this.maskValueMode() === MASK_VALUE_MODES.MASKED ? spec.toDisplay(result.raw) : result.raw,
    );
  }
}
