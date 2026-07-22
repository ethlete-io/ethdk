import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import {
  AnimatableDirective,
  ColorInteractiveExcludeDirective,
  ColorInteractiveHasFocusDirective,
  createCanAnimateSignal,
  injectErrorTheme,
  injectSurfaceThemes,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  resolveSurfaceByElevation,
  signalElementDimensions,
  SURFACE_PROVIDER,
} from '@ethlete/core';
import { EMPTY, filter, switchMap, tap } from 'rxjs';
import { FormErrorComponent } from './form-error.component';
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
  imports: [AnimatableDirective, ColorInteractiveExcludeDirective, FormErrorComponent, ProvideColorDirective],
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
    '[attr.data-expanded]': 'formFieldDir.usesTextFieldShell() && formFieldDir.expanded() ? "" : null',
    // stands in for `:focus-visible` when the focused element is a non-editable trigger (a
    // tabindex div opened by pointer never matches `:focus-visible`), keeping the focused frame
    // and the clear affordance — both keyed on the control's `focused()` — in agreement
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
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });

  protected formFieldDir = inject(FormFieldDirective);

  protected errorColorTheme = injectErrorTheme();
  private surfaceThemes = injectSurfaceThemes({ optional: true });

  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  protected errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  protected hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  private controlFrame = viewChild<ElementRef<HTMLElement>>('controlFrame');
  public prefixEl = viewChild<ElementRef<HTMLElement>>('prefixEl');
  protected errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  protected hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');

  private errorDimensions = signalElementDimensions(this.errorContent);
  private hintDimensions = signalElementDimensions(this.hintContent);
  private prefixDimensions = signalElementDimensions(this.prefixEl);

  private supportPresentation = signal<SupportPresentationState>(INITIAL_SUPPORT_PRESENTATION_STATE);

  private resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parentSurfaceProvider = this.parentSurfaceProvider;

    if (!themes || !parentSurfaceProvider) {
      return null;
    }

    const paintsElevatedFill = this.formFieldDir.usesTextFieldShell() && this.fill() === FORM_FIELD_FILLS.FILLED;

    return resolveSurfaceByElevation(
      themes,
      parentSurfaceProvider.surfaceType() ?? 'dark',
      parentSurfaceProvider.elevation() + (paintsElevatedFill ? 1 : 0),
    );
  });

  public canAnimate = createCanAnimateSignal();

  // real validation errors, or — when the control only has an unparseable committed value — a
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

    if (this.formFieldDir.registeredHint()) {
      return SUPPORT_CONTENT_STATE.HINT;
    }

    return SUPPORT_CONTENT_STATE.NONE;
  });

  protected displaysError = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);

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

    return (
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

  protected shouldRenderHint = computed(() => {
    const presentation = this.supportPresentation();

    return (
      presentation.renderedState === SUPPORT_CONTENT_STATE.HINT ||
      presentation.leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  protected errorActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  protected errorState = computed(() => {
    const presentation = this.supportPresentation();

    return presentation.leavingState === SUPPORT_CONTENT_STATE.ERROR ? 'leaving' : 'active';
  });
  protected errorDirection = computed(() => this.supportPresentation().errorDirection);
  protected visibleErrors = computed(() => this.supportPresentation().renderedErrors);

  protected hintActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);
  protected hintState = computed(() => {
    const presentation = this.supportPresentation();

    return presentation.leavingState === SUPPORT_CONTENT_STATE.HINT ? 'leaving' : 'active';
  });
  protected hintDirection = computed(() => this.supportPresentation().hintDirection);

  protected supportHeight = computed(() => {
    switch (this.semanticSupportState()) {
      case SUPPORT_CONTENT_STATE.ERROR:
        return this.errorDimensions().offset?.height ?? 0;
      case SUPPORT_CONTENT_STATE.HINT:
        return this.hintDimensions().offset?.height ?? 0;
      default:
        return 0;
    }
  });

  constructor() {
    effect(() => {
      const element = this.controlFrame()?.nativeElement ?? null;

      untracked(() => this.formFieldDir.controlFrameElement.set(element));
    });

    toObservable(this.errorAnimatable)
      .pipe(
        switchMap((animatable) => {
          if (!animatable) {
            return EMPTY;
          }

          return animatable.animationEnd$;
        }),
        filter(() => {
          const presentation = this.supportPresentation();

          return (
            presentation.leavingState === SUPPORT_CONTENT_STATE.ERROR &&
            this.semanticSupportState() !== SUPPORT_CONTENT_STATE.ERROR
          );
        }),
        tap(() => {
          this.supportPresentation.update((presentation) => ({
            ...presentation,
            leavingState: SUPPORT_CONTENT_STATE.NONE,
            renderedErrors: [],
            frozenErrorColor: null,
          }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(this.hintAnimatable)
      .pipe(
        switchMap((animatable) => {
          if (!animatable) {
            return EMPTY;
          }

          return animatable.animationEnd$;
        }),
        filter(() => {
          const presentation = this.supportPresentation();

          return (
            presentation.leavingState === SUPPORT_CONTENT_STATE.HINT &&
            this.semanticSupportState() !== SUPPORT_CONTENT_STATE.HINT
          );
        }),
        tap(() => {
          this.supportPresentation.update((presentation) => ({
            ...presentation,
            leavingState: SUPPORT_CONTENT_STATE.NONE,
          }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const semanticSupportState = this.semanticSupportState();
      const errors = this.effectiveErrors();
      const errorContent = this.errorContent()?.nativeElement;
      const currentErrorColor = errorContent ? getComputedStyle(errorContent).color : null;

      this.supportPresentation.update((presentation) =>
        reduceSupportPresentation({
          presentation,
          semanticSupportState,
          errors,
          currentErrorColor,
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
