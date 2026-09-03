import {
  booleanAttribute,
  computed,
  inject,
  Directive,
  InjectionToken,
  TemplateRef,
  input,
  model,
  signal,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, TextFieldControlDirective } from '../../form-field/headless';
import { COLOR_NOTATION_ORDER, COLOR_NOTATIONS, ColorNotation } from '../color-input.types';
import { formatRgbToHex, parseColorToRgb } from './internals/color-convert';
import { createColorPickerOverlay } from './internals/color-picker-overlay';
import { createColorPickerState } from './internals/color-picker-state';

export type ColorInputTriggerBase = {
  elementRef: { nativeElement: HTMLElement };
};

export type ColorInputSurfaceBase = {
  templateRef: TemplateRef<ColorInputSurfaceContext>;
};

/** Context of the template rendered inside the picker overlay pane. */
export type ColorInputSurfaceContext = {
  $implicit: ColorInputDirective;
  close: () => void;
};

export const COLOR_INPUT_TOKEN = new InjectionToken<ColorInputDirective>('COLOR_INPUT_TOKEN');

@Directive({
  selector: '[etColorInput]',
  providers: [{ provide: COLOR_INPUT_TOKEN, useExisting: ColorInputDirective }],
})
export class ColorInputDirective extends TextFieldControlDirective implements FormValueControl<string | null> {
  private ownFormField = inject(FORM_FIELD_TOKEN, { optional: true });

  /** Hex color in `#rrggbb` notation - `#rrggbbaa` while `alpha` is on - or `null` when nothing was picked yet. */
  public value = model<string | null>(null);

  /**
   * Adds an opacity track to the picker and widens the emitted value to `#rrggbbaa`. Pair it with
   * `hexColor({ allowAlpha: true })` if the field is validated.
   */
  public alpha = input(false, { transform: booleanAttribute });

  /**
   * Preset colors offered in the picker, in any notation the color validators accept. An entry that
   * cannot be read is dropped rather than rendered as a broken swatch.
   */
  public swatches = input<readonly string[]>([]);

  /**
   * The notations the picker's entry field offers, in the order its switch cycles through them.
   * More than one shows the switch; exactly one pins the field to that notation, and an entry in
   * another notation is converted to it with an advisory under the field. The emitted `value` is
   * always hex, whatever the field displays.
   */
  public notations = input<readonly ColorNotation[]>(COLOR_NOTATION_ORDER);

  /** Whether the picker overlay is open. */
  public pickerOpen = model(false);

  /** @internal Keeps the form field in its focused style while the picker overlay is open. */
  public expanded = computed(() => this.pickerOpen());

  public hasValue = computed(() => this.mixed() || !!this.value());

  /** Whether the control accepts a new color - the picker refuses to open while it does not. */
  public interactive = computed(() => !this.disabled() && !this.readonly());

  /**
   * The color the picker and the field preview paint - black until a value is picked, and while
   * mixed (the picker must not preselect and thereby reveal the hidden raw color).
   */
  public resolvedColor = computed(() => (this.mixed() ? '#000000' : (this.value() ?? '#000000')));

  /** The color the swatch paints - `null` while mixed so the CSS neutral treatment takes over. */
  public swatchColor = computed(() => (this.mixed() ? null : this.resolvedColor()));

  /** The text the value slot renders - `mixedLabel` while mixed, never the hidden raw color. */
  public displayValue = computed(() => (this.mixed() ? this.resolvedMixedLabel() : (this.value() ?? '')));

  /**
   * The presets that could be read, as canonical hex - so a color given twice in two notations
   * renders one swatch, and the panel can compare a swatch against the current value directly.
   */
  public resolvedSwatches = computed(() => {
    const withAlpha = this.alpha();
    const seen = new Set<string>();

    for (const entry of this.swatches()) {
      const parsed = parseColorToRgb(entry);

      if (parsed) {
        seen.add(formatRgbToHex(parsed, { alpha: withAlpha }));
      }
    }

    return [...seen];
  });

  /**
   * The notations the panel actually offers: the given ones, deduplicated, with anything the picker
   * cannot read dropped. An empty result falls back to hex.
   */
  public resolvedNotations = computed<readonly [ColorNotation, ...ColorNotation[]]>(() => {
    const offered = [...new Set(this.notations())].filter((notation) =>
      COLOR_NOTATION_ORDER.includes(notation as (typeof COLOR_NOTATION_ORDER)[number]),
    );

    return offered.length ? (offered as [ColorNotation, ...ColorNotation[]]) : [COLOR_NOTATIONS.HEX];
  });

  public controlType = signal(FORM_FIELD_CONTROL_TYPES.COLOR_INPUT);

  /** @internal */
  public registeredTrigger = signal<ColorInputTriggerBase | null>(null);

  /** @internal */
  public registeredSurface = signal<ColorInputSurfaceBase | null>(null);

  /** @internal The picker's working color. See {@link createColorPickerState} for why it exists. */
  public picker = createColorPickerState({
    value: this.value,
    mixed: this.mixed,
    alpha: this.alpha,
    interactive: this.interactive,
  });

  private overlay = createColorPickerOverlay({
    interactive: this.interactive,
    pickerOpen: this.pickerOpen,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    context: () => ({ $implicit: this, close: () => this.overlay.close() }) satisfies ColorInputSurfaceContext,
    onAfterClosed: (info) => {
      this.touched.set(true);

      // a deliberate click elsewhere, a tab out, and a swiped-away sheet are the user moving on -
      // only a close from inside an anchored panel (Escape, or the pane itself) hands focus back
      if (!info.byOutsidePointer && !info.byFocusLeave && !info.fromBottomSheet) {
        this.focus();
      }
    },
  });

  public openPicker() {
    if (!this.interactive()) {
      return;
    }

    this.pickerOpen.set(true);
  }

  public closePicker() {
    this.pickerOpen.set(false);
  }

  public togglePicker() {
    if (this.pickerOpen()) {
      this.closePicker();

      return;
    }

    this.openPicker();
  }

  /**
   * The pane anchors to the whole field, not to the trigger inside it - otherwise it opens over the
   * field's own lower edge. It doubles as the region whose pointerdowns toggle instead of close.
   */
  private resolveAnchorElement() {
    return this.ownFormField?.controlFrameElement() ?? this.registeredTrigger()?.elementRef.nativeElement;
  }
}
