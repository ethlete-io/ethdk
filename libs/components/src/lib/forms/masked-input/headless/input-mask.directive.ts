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
import { MASKED_INPUT_ERROR_CODES } from '../masked-input-errors';
import { INPUT_MASK_HOST } from './input-mask-host';
import { MASK_VALUE_MODES, MaskSpec, MaskValueMode } from './input-mask.types';
import { advanceCaretPastLiterals, applyMaskEdit, caretForRawCount, renderMaskDisplay } from './internals/mask-engine';
import { compilePatternMask } from './internals/pattern-mask';

/**
 * Layers input masking onto an existing input control — place it on the same element
 * as `et-input` / `input[etInput]`, or any control providing `INPUT_MASK_HOST`. The
 * native element always shows the masked text; the form value stays raw by default
 * (`maskValueMode`).
 */
@Directive({
  selector: '[etInputMask]',
  exportAs: 'etInputMask',
  host: {
    '(input)': 'handleInput($event)',
    '(compositionstart)': 'composing = true',
    '(compositionend)': 'handleCompositionEnd($event)',
  },
})
export class InputMaskDirective {
  private host = inject(INPUT_MASK_HOST, { optional: true });

  /**
   * The mask: a pattern string (`0` digit, `9` optional digit, `a` letter, `*`
   * alphanumeric, `\` escapes, anything else literal) or a `MaskSpec` object
   * (see `createCurrencyMask` / `createIbanMask` / `createCardMask`). `null`
   * disables the mask entirely — the host's own value-sync stays (or resumes)
   * in charge, so a mask can be applied conditionally.
   */
  public mask = input.required<string | MaskSpec | null>({ alias: 'etInputMask' });

  /** Whether the form value is the raw text (default) or the masked display text. */
  public maskValueMode = input<MaskValueMode>(MASK_VALUE_MODES.RAW);

  /**
   * Renders unfilled slots with this character while the field is focused
   * (e.g. `12-__-____`). Pattern-string masks only.
   */
  public placeholderChar = input<string | null>(null);

  /**
   * `true` between `compositionstart` and `compositionend`. Rewriting `value` +
   * `setSelectionRange` on the intermediate `input` events cancels the IME candidate window
   * mid-composition (CJK, dead keys), so reconciliation is deferred until composition ends.
   */
  protected composing = false;

  private spec = computed(() => {
    const mask = this.mask();

    if (mask === null) {
      return null;
    }

    return typeof mask === 'string' ? compilePatternMask(mask, { placeholderChar: this.placeholderChar() }) : mask;
  });

  /** The unmasked value, regardless of `maskValueMode` (the value as-is while the mask is `null`). */
  public rawValue = computed(() => {
    const value = this.host?.value() ?? '';

    return this.spec()?.toRaw(value) ?? value;
  });

  /**
   * Whether the raw value fills every required slot — `true`/`false` for pattern masks
   * (`0`/`a`/`*` required, `9` optional), `null` when the mask does not track completeness
   * (the shipped factories, custom specs without `isComplete`, a `null` mask).
   */
  public complete = computed(() => this.spec()?.isComplete?.(this.rawValue()) ?? null);

  /**
   * The raw value as of the last reconciliation — `applyMaskEdit` needs the pre-edit
   * raw to detect edits that only removed formatting. Kept as a plain field (not the
   * model) so event-listener ordering can't pollute it.
   */
  private committedRaw = '';

  /** Caret produced by the last handled edit — consumed once by the display enforcement. */
  private caret: number | null = null;

  constructor() {
    // we own value-sync (raw/display split) in `handleInput` — stop the base input's native
    // `(input)` handler from also writing the model and clobbering the masked value.
    // Suppression tracks mask presence: a `null` mask leaves (or hands back) native sync
    effect(() => {
      if (this.spec()) {
        this.host?.suppressNativeSync();
      } else {
        this.host?.resumeNativeSync?.();
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.host) {
          throw new RuntimeError(
            MASKED_INPUT_ERROR_CODES.MASK_OUTSIDE_INPUT,
            'An [etInputMask] must be placed on an input control element (et-input / input[etInput]) or one that provides INPUT_MASK_HOST.',
          );
        }
      });
    }

    // keep the model in its declared shape — this also normalizes programmatic
    // writes (a form reset with masked text, a consumer setting raw text, …)
    effect(() => {
      const host = this.host;
      const spec = this.spec();

      if (!host || !spec) {
        return;
      }

      const value = host.value();
      const raw = spec.toRaw(value);
      const normalized = this.maskValueMode() === MASK_VALUE_MODES.MASKED ? spec.toDisplay(raw) : raw;

      if (normalized !== value) {
        untracked(() => host.value.set(normalized));
      }
    });

    // the element always shows the masked text. This runs after every render because
    // the hosting component's [value] binding writes the model (raw in raw mode)
    // straight into the element — the rewrite happens before paint, so it's invisible.
    afterRenderEffect(() => {
      const host = this.host;
      const element = host?.nativeControl();
      const spec = this.spec();

      if (!host || !element || !spec) {
        return;
      }

      const raw = this.rawValue();
      const focused = host.focused();
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
    if (event.target !== this.host?.nativeControl()) {
      return;
    }

    // an IME is mid-composition — reconcile once it settles (`compositionend`), not on every
    // intermediate `input`, or the candidate window is torn down on the first keystroke
    if (this.composing || (event as InputEvent).isComposing) {
      return;
    }

    this.reconcile((event as InputEvent).inputType);
  }

  protected handleCompositionEnd(event: CompositionEvent) {
    if (event.target !== this.host?.nativeControl()) {
      return;
    }

    this.composing = false;

    // `compositionend` carries the committed text; reconcile it now that the IME is done
    this.reconcile((event as unknown as InputEvent).inputType);
  }

  private reconcile(inputType: string | undefined) {
    const host = this.host;
    const element = host?.nativeControl();
    // a `null` mask never reconciles — the host's own native sync is in charge
    const spec = this.spec();

    if (!host || !element || !spec) {
      return;
    }

    const result = applyMaskEdit({
      spec,
      previousRaw: this.committedRaw,
      text: element.value,
      caret: element.selectionStart ?? element.value.length,
      inputType,
      // typing implies focus, so the guide display (when available) applies
      guide: true,
    });

    this.committedRaw = result.raw;
    this.caret = result.caret;
    element.value = result.display;
    element.setSelectionRange(result.caret, result.caret);
    host.value.set(this.maskValueMode() === MASK_VALUE_MODES.MASKED ? spec.toDisplay(result.raw) : result.raw);
  }
}
