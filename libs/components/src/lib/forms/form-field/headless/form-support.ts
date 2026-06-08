import { computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import {
  AnimatableDirective,
  createProvider,
  injectErrorTheme,
  ProvideColorDirective,
  signalElementDimensions,
} from '@ethlete/core';
import { EMPTY, filter, switchMap, tap } from 'rxjs';
import { FormFieldDirective } from './form-field.directive';

const SUPPORT_CONTENT_STATE = {
  NONE: 'none',
  HINT: 'hint',
  ERROR: 'error',
} as const;

type SupportContentState = (typeof SUPPORT_CONTENT_STATE)[keyof typeof SUPPORT_CONTENT_STATE];

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

  const supportState = signal<{
    renderedErrors: readonly ValidationError.WithOptionalFieldTree[];
    leavingState: SupportContentState;
    frozenErrorColor: string | null;
  }>({ renderedErrors: [], leavingState: SUPPORT_CONTENT_STATE.NONE, frozenErrorColor: null });

  const shouldRenderSupport = computed(() => {
    return (
      semanticSupportState() !== SUPPORT_CONTENT_STATE.NONE ||
      supportState().leavingState !== SUPPORT_CONTENT_STATE.NONE
    );
  });

  const shouldRenderError = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR ||
      supportState().leavingState === SUPPORT_CONTENT_STATE.ERROR
    );
  });

  const shouldRenderHint = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.HINT ||
      supportState().leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  const errorActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  const hintActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);

  const visibleErrors = computed(() => {
    if (semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR) {
      return formFieldDir.errors();
    }

    return supportState().renderedErrors;
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
          supportState().leavingState === SUPPORT_CONTENT_STATE.ERROR &&
          semanticSupportState() !== SUPPORT_CONTENT_STATE.ERROR
        );
      }),
      tap(() => {
        supportState.update((s) => ({
          ...s,
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
          supportState().leavingState === SUPPORT_CONTENT_STATE.HINT &&
          semanticSupportState() !== SUPPORT_CONTENT_STATE.HINT
        );
      }),
      tap(() => {
        supportState.update((s) => ({ ...s, leavingState: SUPPORT_CONTENT_STATE.NONE }));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const state = semanticSupportState();
    const errors = formFieldDir.errors();
    const errorEl = errorContent()?.nativeElement;
    const currentErrorColor = errorEl ? getComputedStyle(errorEl).color : null;

    supportState.update((s) => {
      if (state === SUPPORT_CONTENT_STATE.ERROR) {
        return {
          renderedErrors: errors,
          leavingState:
            s.leavingState === SUPPORT_CONTENT_STATE.HINT ? SUPPORT_CONTENT_STATE.HINT : SUPPORT_CONTENT_STATE.NONE,
          frozenErrorColor: null,
        };
      }

      if (state === SUPPORT_CONTENT_STATE.HINT) {
        const hasErrors = s.renderedErrors.length > 0;

        return {
          renderedErrors: hasErrors ? s.renderedErrors : [],
          leavingState: hasErrors ? SUPPORT_CONTENT_STATE.ERROR : SUPPORT_CONTENT_STATE.NONE,
          frozenErrorColor: hasErrors ? (s.frozenErrorColor ?? currentErrorColor) : null,
        };
      }

      const leaving =
        s.renderedErrors.length > 0
          ? SUPPORT_CONTENT_STATE.ERROR
          : formFieldDir.registeredHint()
            ? SUPPORT_CONTENT_STATE.HINT
            : SUPPORT_CONTENT_STATE.NONE;

      return {
        renderedErrors: s.renderedErrors,
        leavingState: leaving,
        frozenErrorColor: leaving === SUPPORT_CONTENT_STATE.ERROR ? (s.frozenErrorColor ?? currentErrorColor) : null,
      };
    });
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
