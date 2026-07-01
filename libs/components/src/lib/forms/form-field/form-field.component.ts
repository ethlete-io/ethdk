import {
  ChangeDetectionStrategy,
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
import { FormFieldDirective } from './headless';

const SUPPORT_CONTENT_STATE = {
  NONE: 'none',
  HINT: 'hint',
  ERROR: 'error',
} as const;

type SupportContentState = (typeof SUPPORT_CONTENT_STATE)[keyof typeof SUPPORT_CONTENT_STATE];

const SUPPORT_TRANSITION_DIRECTION = {
  FROM_ABOVE: 'from-above',
  FROM_BELOW: 'from-below',
  TO_ABOVE: 'to-above',
  TO_BELOW: 'to-below',
} as const;

type SupportTransitionDirection = (typeof SUPPORT_TRANSITION_DIRECTION)[keyof typeof SUPPORT_TRANSITION_DIRECTION];

type SupportPresentationState = {
  renderedState: SupportContentState;
  leavingState: SupportContentState;
  renderedErrors: readonly ValidationError.WithOptionalFieldTree[];
  frozenErrorColor: string | null;
  errorDirection: SupportTransitionDirection;
  hintDirection: SupportTransitionDirection;
};

type ReduceSupportPresentationInput = {
  presentation: SupportPresentationState;
  semanticSupportState: SupportContentState;
  errors: readonly ValidationError.WithOptionalFieldTree[];
  currentErrorColor: string | null;
};

const INITIAL_SUPPORT_PRESENTATION_STATE: SupportPresentationState = {
  renderedState: SUPPORT_CONTENT_STATE.NONE,
  leavingState: SUPPORT_CONTENT_STATE.NONE,
  renderedErrors: [],
  frozenErrorColor: null,
  errorDirection: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
  hintDirection: SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE,
};

const supportPresentationIncludesState = ({
  presentation,
  state,
}: {
  presentation: SupportPresentationState;
  state: SupportContentState;
}) => {
  return presentation.renderedState === state || presentation.leavingState === state;
};

const reduceSupportPresentation = ({
  presentation,
  semanticSupportState,
  errors,
  currentErrorColor,
}: ReduceSupportPresentationInput) => {
  if (semanticSupportState === SUPPORT_CONTENT_STATE.ERROR) {
    const hasHintPresentation = supportPresentationIncludesState({
      presentation,
      state: SUPPORT_CONTENT_STATE.HINT,
    });

    return {
      ...presentation,
      renderedState: SUPPORT_CONTENT_STATE.ERROR,
      leavingState: hasHintPresentation ? SUPPORT_CONTENT_STATE.HINT : SUPPORT_CONTENT_STATE.NONE,
      renderedErrors: errors,
      frozenErrorColor: null,
      errorDirection: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
      hintDirection: hasHintPresentation ? SUPPORT_TRANSITION_DIRECTION.TO_ABOVE : presentation.hintDirection,
    };
  }

  if (semanticSupportState === SUPPORT_CONTENT_STATE.HINT) {
    const hasErrorPresentation = supportPresentationIncludesState({
      presentation,
      state: SUPPORT_CONTENT_STATE.ERROR,
    });

    return {
      ...presentation,
      renderedState: SUPPORT_CONTENT_STATE.HINT,
      leavingState: hasErrorPresentation ? SUPPORT_CONTENT_STATE.ERROR : SUPPORT_CONTENT_STATE.NONE,
      renderedErrors: hasErrorPresentation ? presentation.renderedErrors : [],
      frozenErrorColor: hasErrorPresentation ? (presentation.frozenErrorColor ?? currentErrorColor) : null,
      errorDirection: hasErrorPresentation ? SUPPORT_TRANSITION_DIRECTION.TO_BELOW : presentation.errorDirection,
      hintDirection: hasErrorPresentation ? SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE : presentation.hintDirection,
    };
  }

  const nextLeavingState = supportPresentationIncludesState({
    presentation,
    state: SUPPORT_CONTENT_STATE.ERROR,
  })
    ? SUPPORT_CONTENT_STATE.ERROR
    : supportPresentationIncludesState({
          presentation,
          state: SUPPORT_CONTENT_STATE.HINT,
        })
      ? SUPPORT_CONTENT_STATE.HINT
      : SUPPORT_CONTENT_STATE.NONE;

  return {
    ...presentation,
    renderedState: SUPPORT_CONTENT_STATE.NONE,
    leavingState: nextLeavingState,
    renderedErrors: nextLeavingState === SUPPORT_CONTENT_STATE.ERROR ? presentation.renderedErrors : [],
    frozenErrorColor:
      nextLeavingState === SUPPORT_CONTENT_STATE.ERROR ? (presentation.frozenErrorColor ?? currentErrorColor) : null,
    errorDirection:
      nextLeavingState === SUPPORT_CONTENT_STATE.ERROR
        ? SUPPORT_TRANSITION_DIRECTION.TO_BELOW
        : presentation.errorDirection,
    hintDirection:
      nextLeavingState === SUPPORT_CONTENT_STATE.HINT
        ? SUPPORT_TRANSITION_DIRECTION.TO_ABOVE
        : presentation.hintDirection,
  };
};

@Component({
  selector: 'et-form-field',
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatableDirective, ColorInteractiveExcludeDirective, FormErrorComponent, ProvideColorDirective],
  hostDirectives: [
    FormFieldDirective,
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
    { directive: ProvideSurfaceDirective, inputs: ['etProvideSurface:surface'] },
    ColorInteractiveHasFocusDirective,
  ],
  host: {
    class: 'et-form-field',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-control-type]': 'formFieldDir.controlType()',
    '[attr.data-error]': 'displaysError() || null',
    '[attr.data-appearance]': 'formFieldDir.usesTextFieldShell() ? appearance() : null',
    '[attr.data-fill]': 'formFieldDir.usesTextFieldShell() ? fill() : null',
    '[attr.data-label-floated]': 'hasFloatingTextLabel() && formFieldDir.shouldFloatLabel() ? "" : null',
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

  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  protected errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  protected hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  public prefixEl = viewChild<ElementRef<HTMLElement>>('prefixEl');
  protected errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  protected hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');

  protected errorColorTheme = injectErrorTheme();
  private surfaceThemes = injectSurfaceThemes({ optional: true });

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

    return resolveSurfaceByElevation(
      themes,
      parentSurfaceProvider.surfaceType() ?? 'dark',
      parentSurfaceProvider.elevation() + 1,
    );
  });

  public canAnimate = createCanAnimateSignal();

  public semanticSupportState = computed<SupportContentState>(() => {
    if (this.formFieldDir.shouldDisplayError() && this.formFieldDir.errors().length > 0) {
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
      const errors = this.formFieldDir.errors();
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

    const target = event.target as HTMLElement;
    const tagName = target.tagName;

    if (
      target.isContentEditable ||
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      tagName === 'BUTTON' ||
      tagName === 'A'
    ) {
      return;
    }

    event.preventDefault();
    this.formFieldDir.activate();
  }
}
