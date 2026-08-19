import {
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ValidationError } from '@angular/forms/signals';
import {
  AnimatableDirective,
  ColorInteractiveExcludeDirective,
  ColorInteractiveHasFocusDirective,
  createCanAnimateSignal,
  injectErrorTheme,
  injectParentSurface,
  injectSurfaceThemes,
  injectWarningTheme,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  resolveSurfaceByElevation,
  signalDeferredLoading,
  signalElementDimensions,
} from '@ethlete/core';
import { SpinnerComponent } from '../../loader';
import { FormErrorComponent } from './form-error.component';
import { FormWarningComponent } from './form-warning.component';
import {
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_FILLS,
  FORM_FIELD_LABEL_MODES,
  FORM_FIELD_SIZES,
  FormFieldAppearance,
  FormFieldFill,
  FormFieldLabelMode,
  FormFieldSize,
} from './form-field.variants';
import {
  clearLeavingSupportStateOnExit,
  FormFieldDirective,
  INITIAL_SUPPORT_PRESENTATION_STATE,
  isInteractiveElement,
  reduceSupportPresentation,
  SUPPORT_CONTENT_STATE,
  SupportContentState,
  SupportPresentationState,
} from './headless';

@Component({
  selector: 'et-form-field',
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    ColorInteractiveExcludeDirective,
    FormErrorComponent,
    FormWarningComponent,
    NgTemplateOutlet,
    ProvideColorDirective,
    SpinnerComponent,
  ],
  hostDirectives: [
    FormFieldDirective,
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
    { directive: ProvideSurfaceDirective, inputs: ['etProvideSurface:surface'] },
    ColorInteractiveHasFocusDirective,
  ],
  host: {
    class: 'et-form-field',
    // a signal-forms schema-hidden control removes the whole field (inline style beats the
    // component's own `display`); the field also drops out of the a11y tree, as `hidden` intends
    '[style.display]': 'formFieldDir.isHidden() ? "none" : null',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-control-type]': 'formFieldDir.controlType()',
    '[attr.data-error]': 'displaysError() || null',
    '[attr.data-warning]': 'displaysWarning() || null',
    '[attr.aria-busy]': 'isBusy() ? "true" : null',
    '[attr.data-busy]': 'isBusy() || null',
    '[attr.data-expanded]': 'formFieldDir.usesTextFieldShell() && formFieldDir.expanded() ? "" : null',
    // stands in for `:focus-visible` when the focused element is a non-editable trigger (a
    // tabindex div opened by pointer never matches `:focus-visible`), keeping the focused frame
    // and the clear affordance - both keyed on the control's `focused()` - in agreement
    '[attr.data-focused]': 'formFieldDir.usesTextFieldShell() && formFieldDir.focused() ? "" : null',
    '[attr.data-readonly]': 'formFieldDir.usesTextFieldShell() && formFieldDir.isReadonly() ? "" : null',
    '[attr.data-disabled]': 'formFieldDir.usesTextFieldShell() && formFieldDir.isDisabled() ? "" : null',
    '[attr.data-appearance]': 'formFieldDir.usesTextFieldShell() ? appearance() : null',
    '[attr.data-fill]': 'formFieldDir.usesTextFieldShell() ? fill() : null',
    '[attr.data-label-floated]': 'hasFloatingTextLabel() && formFieldDir.shouldFloatLabel() ? "" : null',
    '[attr.data-has-label]': 'formFieldDir.registeredLabel() ? "" : null',
    '[attr.data-label-mode]': 'formFieldDir.usesTextFieldShell() ? labelMode() : null',
    '[attr.data-size]': 'formFieldDir.usesTextFieldShell() ? size() : null',
    '[attr.data-text-shell]': 'formFieldDir.usesTextFieldShell() || null',
    '[style.--_et-form-field-prefix-offset]': 'prefixOffset()',
  },
})
export class FormFieldComponent {
  private provideColor = inject(ProvideColorDirective);
  private provideSurface = inject(ProvideSurfaceDirective);
  private parentSurface = injectParentSurface();
  private injector = inject(Injector);

  protected formFieldDir = inject(FormFieldDirective);

  protected errorColorTheme = injectErrorTheme();
  private surfaceThemes = injectSurfaceThemes({ optional: true });

  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  /**
   * Forces the busy state on. The field already shows it while an async validator is in flight for
   * the bound field; use this for work the form doesn't know about (saving, a lookup of your own).
   */
  public busy = input(false, { transform: booleanAttribute });

  public errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  public warningContent = viewChild<ElementRef<HTMLElement>>('warningContent');
  public hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  public counterContent = viewChild<ElementRef<HTMLElement>>('counterContent');
  private controlFrame = viewChild<ElementRef<HTMLElement>>('controlFrame');
  public prefixEl = viewChild<ElementRef<HTMLElement>>('prefixEl');
  public errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  public warningAnimatable = viewChild<AnimatableDirective>('warningAnimatable');
  public hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');

  /** Whether the field is busy - a pending async validator, or `[busy]`. */
  public isBusy = computed(() => this.busy() || this.formFieldDir.isPending());

  /**
   * The spinner follows `isBusy()` late: a validator that settles in a few dozen milliseconds would
   * otherwise flash one. `aria-busy` still reports the real state from the first moment.
   */
  protected showBusySpinner = signalDeferredLoading(this.isBusy);

  private errorDimensions = signalElementDimensions(this.errorContent);
  private warningDimensions = signalElementDimensions(this.warningContent);
  private hintDimensions = signalElementDimensions(this.hintContent);
  private counterDimensions = signalElementDimensions(this.counterContent);
  private prefixDimensions = signalElementDimensions(this.prefixEl);

  private supportPresentation = signal<SupportPresentationState>(INITIAL_SUPPORT_PRESENTATION_STATE);

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parentSurface = this.parentSurface();

    if (!themes || !parentSurface) {
      return null;
    }

    const paintsElevatedFill = this.formFieldDir.usesTextFieldShell() && this.fill() === FORM_FIELD_FILLS.FILLED;

    return resolveSurfaceByElevation(
      themes,
      parentSurface.type,
      parentSurface.elevation + (paintsElevatedFill ? 1 : 0),
    );
  });

  public canAnimate = createCanAnimateSignal();

  // real validation errors, or - when the control only has an unparseable committed value - a
  // synthetic one carrying its parse message, so a parse error renders like any other error
  // (red styling + a message + aria-describedby) instead of a silent `aria-invalid`
  public effectiveErrors = computed<readonly ValidationError.WithOptionalFieldTree[]>(() => {
    const errors = this.formFieldDir.errors();

    if (errors.length > 0) {
      return errors;
    }

    const parseMessage = this.formFieldDir.parseError() ? this.formFieldDir.parseErrorMessage() : null;

    return parseMessage ? [{ kind: 'etParseError', message: parseMessage }] : [];
  });

  public semanticSupportState = computed<SupportContentState>(() => {
    if (this.formFieldDir.shouldDisplayError() && this.effectiveErrors().length > 0) {
      return SUPPORT_CONTENT_STATE.ERROR;
    }

    if (this.formFieldDir.warnings().length > 0) {
      return SUPPORT_CONTENT_STATE.WARNING;
    }

    if (this.formFieldDir.registeredHint()) {
      return SUPPORT_CONTENT_STATE.HINT;
    }

    return SUPPORT_CONTENT_STATE.NONE;
  });

  protected displaysError = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);

  protected displaysWarning = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING);

  protected hasFloatingTextLabel = computed(
    () =>
      this.formFieldDir.usesTextFieldShell() &&
      this.labelMode() !== FORM_FIELD_LABEL_MODES.STATIC &&
      this.labelMode() !== FORM_FIELD_LABEL_MODES.INLINE,
  );

  protected hasInlineLabel = computed(
    () => this.formFieldDir.usesTextFieldShell() && this.labelMode() === FORM_FIELD_LABEL_MODES.INLINE,
  );

  protected prefixOffset = computed(() => {
    const width = this.prefixDimensions()?.offset?.width;

    if (!width) {
      return null;
    }

    return `calc(${width}px + var(--et-form-field-control-affix-gap))`;
  });

  protected shouldRenderSupport = computed(() => {
    const presentation = this.supportPresentation();

    // A counter alone is reason enough to open the support region - it is persistent, so unlike the
    // hint and error it isn't part of the swapping state machine.
    return (
      !!this.formFieldDir.registeredCounter() ||
      presentation.renderedState !== SUPPORT_CONTENT_STATE.NONE ||
      presentation.leavingState !== SUPPORT_CONTENT_STATE.NONE
    );
  });

  protected shouldRenderError = computed(() => {
    const presentation = this.supportPresentation();

    return (
      presentation.renderedState === SUPPORT_CONTENT_STATE.ERROR ||
      presentation.leavingState === SUPPORT_CONTENT_STATE.ERROR
    );
  });

  protected shouldRenderWarning = computed(() => {
    const presentation = this.supportPresentation();

    return (
      presentation.renderedState === SUPPORT_CONTENT_STATE.WARNING ||
      presentation.leavingState === SUPPORT_CONTENT_STATE.WARNING
    );
  });

  protected shouldRenderHint = computed(() => {
    const presentation = this.supportPresentation();

    return (
      presentation.renderedState === SUPPORT_CONTENT_STATE.HINT ||
      presentation.leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  // Resolved only once a warning actually renders: a field that never warns shouldn't force the app
  // to register a `type: 'warning'` theme. It colors the message and nothing else - the control frame
  // keeps its normal styling, because a warned field is not an invalid one.
  protected warningColorTheme = computed(() =>
    this.shouldRenderWarning() ? runInInjectionContext(this.injector, injectWarningTheme) : null,
  );

  protected errorActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  protected errorState = computed(() => {
    const presentation = this.supportPresentation();

    return presentation.leavingState === SUPPORT_CONTENT_STATE.ERROR ? 'leaving' : 'active';
  });
  protected errorDirection = computed(() => this.supportPresentation().directions.error);
  protected visibleErrors = computed(() => this.supportPresentation().renderedErrors);

  protected warningActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING);
  protected warningState = computed(() => {
    const presentation = this.supportPresentation();

    return presentation.leavingState === SUPPORT_CONTENT_STATE.WARNING ? 'leaving' : 'active';
  });
  protected warningDirection = computed(() => this.supportPresentation().directions.warning);
  protected visibleWarnings = computed(() => this.supportPresentation().renderedWarnings);

  protected hintActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);
  protected hintState = computed(() => {
    const presentation = this.supportPresentation();

    return presentation.leavingState === SUPPORT_CONTENT_STATE.HINT ? 'leaving' : 'active';
  });
  protected hintDirection = computed(() => this.supportPresentation().directions.hint);

  protected supportHeight = computed(() => {
    const stackHeight = (() => {
      switch (this.semanticSupportState()) {
        case SUPPORT_CONTENT_STATE.ERROR:
          return this.errorDimensions().offset?.height ?? 0;
        case SUPPORT_CONTENT_STATE.WARNING:
          return this.warningDimensions().offset?.height ?? 0;
        case SUPPORT_CONTENT_STATE.HINT:
          return this.hintDimensions().offset?.height ?? 0;
        default:
          return 0;
      }
    })();

    // The support region animates its own height, so a counter with no hint or error still has to
    // contribute one - otherwise the row it sits in would be clipped to zero.
    const counterHeight = this.formFieldDir.registeredCounter() ? (this.counterDimensions().offset?.height ?? 0) : 0;

    return Math.max(stackHeight, counterHeight);
  });

  constructor() {
    effect(() => {
      const element = this.controlFrame()?.nativeElement ?? null;

      untracked(() => this.formFieldDir.controlFrameElement.set(element));
    });

    for (const [state, animatable] of [
      [SUPPORT_CONTENT_STATE.ERROR, this.errorAnimatable],
      [SUPPORT_CONTENT_STATE.WARNING, this.warningAnimatable],
      [SUPPORT_CONTENT_STATE.HINT, this.hintAnimatable],
    ] as const) {
      clearLeavingSupportStateOnExit({
        state,
        animatable,
        presentation: this.supportPresentation,
        semanticSupportState: this.semanticSupportState,
      });
    }

    effect(() => {
      const semanticSupportState = this.semanticSupportState();
      const errors = this.effectiveErrors();
      const warnings = this.formFieldDir.warnings();

      this.supportPresentation.update((presentation) =>
        reduceSupportPresentation({
          presentation,
          semanticSupportState,
          errors,
          warnings,
        }),
      );
    });

    effect(() => {
      const showError = this.displaysError();

      untracked(() => {
        if (showError) {
          this.provideColor.forceColor(this.errorColorTheme);

          return;
        }

        this.provideColor.clearForcedColor();
      });
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        if (surface) {
          this.provideSurface.forceSurface(surface.name);

          return;
        }

        this.provideSurface.clearForcedSurface();
      });
    });
  }

  protected handleFramePointerDown(event: MouseEvent) {
    if (!this.formFieldDir.usesTextFieldShell()) {
      return;
    }

    if (isInteractiveElement(event.target as HTMLElement)) {
      return;
    }

    event.preventDefault();
    this.formFieldDir.activate();
  }
}
