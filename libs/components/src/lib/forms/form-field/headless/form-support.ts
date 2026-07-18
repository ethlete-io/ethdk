import { computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AnimatableDirective,
  createProvider,
  injectErrorTheme,
  ProvideColorDirective,
  signalElementDimensions,
} from '@ethlete/core';
import { EMPTY, filter, switchMap, tap } from 'rxjs';
import { FormFieldDirective } from './form-field.directive';
import {
  INITIAL_SUPPORT_PRESENTATION_STATE,
  reduceSupportPresentation,
  SUPPORT_CONTENT_STATE,
  SupportContentState,
} from './support-presentation';

const formSupportFactory = () => {
  const provideColor = inject(ProvideColorDirective, { optional: true });
  const formFieldDir = inject(FormFieldDirective);
  const errorColorTheme = injectErrorTheme();

  const errorContent = signal<ElementRef<HTMLElement> | undefined>(undefined);
  const hintContent = signal<ElementRef<HTMLElement> | undefined>(undefined);
  const errorAnimatable = signal<AnimatableDirective | undefined>(undefined);
  const hintAnimatable = signal<AnimatableDirective | undefined>(undefined);

  const errorDimensions = signalElementDimensions(errorContent);
  const hintDimensions = signalElementDimensions(hintContent);

  const semanticSupportState = computed<SupportContentState>(() => {
    if (formFieldDir.shouldDisplayError() && formFieldDir.errors().length > 0) {
      return SUPPORT_CONTENT_STATE.ERROR;
    }

    if (formFieldDir.registeredHint()) {
      return SUPPORT_CONTENT_STATE.HINT;
    }

    return SUPPORT_CONTENT_STATE.NONE;
  });

  const displaysError = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);

  // the enter/leave/frozen-color state machine is shared with the text-field shell — see
  // `support-presentation.ts`. This holds only the presentation state; the derived render flags
  // below read it alongside the live `semanticSupportState`.
  const supportPresentation = signal(INITIAL_SUPPORT_PRESENTATION_STATE);

  const shouldRenderSupport = computed(() => {
    return (
      semanticSupportState() !== SUPPORT_CONTENT_STATE.NONE ||
      supportPresentation().leavingState !== SUPPORT_CONTENT_STATE.NONE
    );
  });

  const shouldRenderError = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR ||
      supportPresentation().leavingState === SUPPORT_CONTENT_STATE.ERROR
    );
  });

  const shouldRenderHint = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.HINT ||
      supportPresentation().leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  const errorActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  const hintActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);

  const visibleErrors = computed(() => {
    if (semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR) {
      return formFieldDir.errors();
    }

    return supportPresentation().renderedErrors;
  });

  const supportHeight = computed(() => {
    switch (semanticSupportState()) {
      case SUPPORT_CONTENT_STATE.ERROR:
        return errorDimensions().offset?.height ?? 0;
      case SUPPORT_CONTENT_STATE.HINT:
        return hintDimensions().offset?.height ?? 0;
      default:
        return 0;
    }
  });

  toObservable(errorAnimatable)
    .pipe(
      switchMap((animatable) => (animatable ? animatable.animationEnd$ : EMPTY)),
      filter(() => {
        return (
          supportPresentation().leavingState === SUPPORT_CONTENT_STATE.ERROR &&
          semanticSupportState() !== SUPPORT_CONTENT_STATE.ERROR
        );
      }),
      tap(() => {
        supportPresentation.update((presentation) => ({
          ...presentation,
          leavingState: SUPPORT_CONTENT_STATE.NONE,
          renderedErrors: [],
          frozenErrorColor: null,
        }));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  toObservable(hintAnimatable)
    .pipe(
      switchMap((animatable) => (animatable ? animatable.animationEnd$ : EMPTY)),
      filter(() => {
        return (
          supportPresentation().leavingState === SUPPORT_CONTENT_STATE.HINT &&
          semanticSupportState() !== SUPPORT_CONTENT_STATE.HINT
        );
      }),
      tap(() => {
        supportPresentation.update((presentation) => ({ ...presentation, leavingState: SUPPORT_CONTENT_STATE.NONE }));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const state = semanticSupportState();
    const errors = formFieldDir.errors();
    const errorEl = errorContent()?.nativeElement;
    const currentErrorColor = errorEl ? getComputedStyle(errorEl).color : null;

    supportPresentation.update((presentation) =>
      reduceSupportPresentation({ presentation, semanticSupportState: state, errors, currentErrorColor }),
    );
  });

  effect(() => {
    const showError = displaysError();

    untracked(() => {
      if (!provideColor) return;

      if (showError) {
        provideColor.forceColor(errorColorTheme);

        return;
      }

      provideColor.clearForcedColor();
    });
  });

  return {
    errorColorTheme,
    formFieldDir,
    errorContent,
    hintContent,
    errorAnimatable,
    hintAnimatable,
    semanticSupportState,
    displaysError,
    shouldRenderSupport,
    shouldRenderError,
    shouldRenderHint,
    errorActive,
    hintActive,
    visibleErrors,
    supportHeight,
  };
};

export const [provideFormSupport, injectFormSupport] = createProvider(formSupportFactory, {
  name: 'FormSupport',
});
