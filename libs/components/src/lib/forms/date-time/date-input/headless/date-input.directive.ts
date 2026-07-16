import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  computed,
  effect,
  inject,
  inputBinding,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError } from '@ethlete/core';
import { Locale } from 'date-fns';
import { fromEvent, take, tap } from 'rxjs';
import { OverlayConfig } from '../../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../../overlay/overlay-manager';
import { OverlayRef } from '../../../../overlay/overlay-ref';
import { OverlayTemplateHostComponent } from '../../../../overlay/overlay-template-host.component';
import { anchoredOverlayStrategy } from '../../../../overlay/strategies';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../../form-field/headless';
import { injectDateFormat, injectDateLocale } from '../../date-time-formats';
import { formatDateValue, parseDateValue } from '../../internals/date-value';
import { DATE_INPUT_ERROR_CODES } from '../date-input-errors';
import { DateInputFieldDirective } from './date-input-field.directive';
import { DatePickerSurfaceDirective } from './date-picker-surface.directive';
import { DatePickerTriggerDirective } from './date-picker-trigger.directive';

/**
 * A date form control with a `string | null` value (a date-fns `valueFormat`
 * wire string, ISO by default). Typed entry parses strictly against
 * `displayFormat` on blur/Enter; the anchored picker overlay hosts a calendar.
 * String↔`Date` conversion happens exclusively here — the calendar itself
 * only ever sees `Date` objects.
 */
@Directive({
  selector: '[etDateInput]',
  exportAs: 'etDateInput',
})
export class DateInputDirective implements FormValueControl<string | null>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private overlayManager = injectOverlayManager();
  private document = inject(DOCUMENT);
  private defaultValueFormat = injectDateFormat();
  private defaultLocale = injectDateLocale();

  /** The wire value in `valueFormat`, or `null` while empty/unparseable. */
  public value = model<string | null>(null);
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  /** date-fns format of the string value. Defaults to the `DATE_FORMAT` token. */
  public valueFormat = input<string | undefined>(undefined);
  /** date-fns format shown in (and parsed from) the field. Locale-aware by default. */
  public displayFormat = input('P');
  public locale = input<Locale | null>(null);

  /** Forwarded to the picker calendar. (`min`/`max` are reserved by signal forms.) */
  public minDate = input<Date | null>(null);
  public maxDate = input<Date | null>(null);
  public dateFilter = input<((date: Date) => boolean) | null>(null);

  public pickerOpen = model(false);

  public effectiveValueFormat = computed(() => this.valueFormat() ?? this.defaultValueFormat);
  public effectiveLocale = computed(() => this.locale() ?? this.defaultLocale);

  /** The current value as a `Date` (what the picker calendar binds to). */
  public date = computed(() => {
    const value = this.value();

    if (value === null) {
      return null;
    }

    return parseDateValue(value, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() });
  });

  /** The committed value rendered in `displayFormat`. */
  public displayValue = computed(() => {
    const date = this.date();

    if (date === null) {
      return '';
    }

    return formatDateValue(date, { format: this.displayFormat(), locale: this.effectiveLocale() }) ?? '';
  });

  /** Uncommitted field text — kept visible when it fails to parse. */
  public inputText = signal('');
  /** `true` while the field holds text that does not parse against `displayFormat`. */
  public parseError = signal(false);

  public focused = signal(false);
  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.DATE_INPUT);

  /** @internal */
  public registeredField = signal<DateInputFieldDirective | null>(null);
  /** @internal */
  public registeredTrigger = signal<DatePickerTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<DatePickerSurfaceDirective | null>(null);

  public interactive = computed(() => !this.disabled() && !this.readonly());
  public hasValue = computed(() => this.value() !== null || this.inputText().length > 0);
  public shouldDisplayError = computed(() => this.touched() && (this.invalid() || this.parseError()));

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);
  public describedById = computed(() => this.describedBy());

  /** @internal */
  public overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);

  private interactionListenersCleanup: (() => void) | null = null;
  private closedByOutsidePointer = false;

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    effect(() => {
      const interactive = this.interactive();
      const shouldBeOpen = this.pickerOpen();
      const currentRef = this.overlayRef();

      if (!interactive) {
        if (currentRef) {
          untracked(() => currentRef.close());
        }

        if (shouldBeOpen) {
          untracked(() => this.pickerOpen.set(false));
        }

        return;
      }

      if (shouldBeOpen && !currentRef) {
        untracked(() => this.mountOverlay());

        return;
      }

      if (!shouldBeOpen && currentRef) {
        untracked(() => currentRef.close());
      }
    });

    this.destroyRef.onDestroy(() => {
      this.detachInteractionListeners();
      this.overlayRef()?.close();
    });
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    this.registeredField()?.focus();
  }

  public openPicker() {
    if (!this.interactive() || this.pickerOpen()) {
      return;
    }

    this.pickerOpen.set(true);
  }

  public closePicker() {
    if (this.pickerOpen()) {
      this.pickerOpen.set(false);
    }

    this.overlayRef()?.close();
  }

  public togglePicker() {
    if (this.pickerOpen()) {
      this.closePicker();
    } else {
      this.openPicker();
    }
  }

  /**
   * @internal Commits typed field text: empty clears, a strict `displayFormat`
   * parse writes the value, anything else keeps the raw text and raises
   * `parseError` (the value stays `null`).
   */
  public commitInput(raw: string) {
    if (!raw.trim()) {
      this.inputText.set('');
      this.parseError.set(false);

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    const parsed = parseDateValue(raw, { format: this.displayFormat(), locale: this.effectiveLocale() });

    if (parsed === null) {
      this.inputText.set(raw);
      this.parseError.set(true);

      if (this.value() !== null) {
        this.value.set(null);
      }

      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(parsed, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
  }

  /** Commits a picker-selected date and closes the picker. */
  public selectDate(date: Date | null) {
    if (date === null || !this.interactive()) {
      return;
    }

    this.inputText.set('');
    this.parseError.set(false);
    this.value.set(formatDateValue(date, { format: this.effectiveValueFormat(), locale: this.effectiveLocale() }));
    this.touched.set(true);
    this.closePicker();
  }

  // the field is the anchor inside a form field so the panel lines up with the visible box
  private resolveAnchorElement() {
    return (
      this.formField?.controlFrameElement() ??
      this.registeredField()?.elementRef.nativeElement ??
      this.registeredTrigger()?.elementRef.nativeElement
    );
  }

  private mountOverlay() {
    const surface = this.registeredSurface();

    if (!surface) {
      if (ngDevMode) {
        throw new RuntimeError(
          DATE_INPUT_ERROR_CODES.MISSING_SURFACE,
          '[DateInputDirective] Cannot open the picker without an <ng-template etDatePickerSurface> inside the [etDateInput] element.',
        );
      }

      return;
    }

    const templateContext: DatePickerSurfaceContext = {
      $implicit: this,
      dateInput: this,
      close: () => this.closePicker(),
    };

    const config: OverlayConfig = {
      bindings: [inputBinding('template', () => surface.templateRef), inputBinding('context', () => templateContext)],
      mode: 'non-modal',
      hasBackdrop: false,
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      // outside-pointer closing is owned below: a pointerdown on the field/trigger
      // (both inside the anchor) must toggle instead of close-and-reopen
      closeOnEscape: true,
      closeOnOutsidePointer: false,
      origin: this.resolveAnchorElement(),
      panelClass: 'et-date-input-overlay-pane',
      strategies: anchoredOverlayStrategy({
        containerClass: ['et-overlay--anchored', 'et-overlay--date-picker'],
        placement: 'bottom-start',
        fallbackPlacements: ['top-start'],
        offset: 4,
        viewportPadding: 8,
        autoResize: true,
        shift: { crossAxis: true },
      }),
    };

    const overlayRef = this.overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, config);

    this.overlayRef.set(overlayRef);
    this.attachInteractionListeners();

    // sync the open model as soon as any close begins (Escape, outside pointer) so
    // aria-expanded flips before the leave animation
    overlayRef
      .beforeClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() !== overlayRef) {
            return;
          }

          this.detachInteractionListeners();

          if (this.pickerOpen()) {
            this.pickerOpen.set(false);
          }
        }),
      )
      .subscribe();

    overlayRef
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() !== overlayRef) {
            return;
          }

          this.overlayRef.set(null);

          const closedByOutsidePointer = this.closedByOutsidePointer;

          this.closedByOutsidePointer = false;

          // focus fell to <body> with the pane's removal — hand it back to the field,
          // except for outside closes (the user deliberately went elsewhere)
          if (!closedByOutsidePointer && this.document.activeElement === this.document.body) {
            this.activate();
          }
        }),
      )
      .subscribe();
  }

  private attachInteractionListeners() {
    this.detachInteractionListeners();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const pane = this.overlayRef()?.elements?.paneElement;

      if (pane?.contains(target)) {
        return;
      }

      const anchor = this.resolveAnchorElement();

      if (anchor?.contains(target)) {
        return;
      }

      this.closedByOutsidePointer = true;
      this.closePicker();
    };

    const pointerdownSubscription = fromEvent<PointerEvent>(this.document, 'pointerdown', { capture: true }).subscribe(
      onPointerDown,
    );

    this.interactionListenersCleanup = () => {
      pointerdownSubscription.unsubscribe();
    };
  }

  private detachInteractionListeners() {
    this.interactionListenersCleanup?.();
    this.interactionListenersCleanup = null;
  }
}

export type DatePickerSurfaceContext = {
  $implicit: DateInputDirective;
  dateInput: DateInputDirective;
  close: () => void;
};
