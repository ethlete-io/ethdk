import { ValidationError } from '@angular/forms/signals';

/**
 * The support region under a form control shows at most one of an error or a hint at a time, with
 * an animated cross-fade/slide when it switches. This module owns that little state machine so the
 * text-field shell (`form-field.component`) and the headless `injectFormSupport` (rating, otp,
 * slider, selection groups, dropzone, choice-field, …) share one implementation instead of two
 * that drift. Callers keep their own view-child wiring, error source, and derived signals — only
 * the reducer, state shape, and enum constants live here.
 */

export const SUPPORT_CONTENT_STATE = {
  NONE: 'none',
  HINT: 'hint',
  ERROR: 'error',
} as const;

export type SupportContentState = (typeof SUPPORT_CONTENT_STATE)[keyof typeof SUPPORT_CONTENT_STATE];

export const SUPPORT_TRANSITION_DIRECTION = {
  FROM_ABOVE: 'from-above',
  FROM_BELOW: 'from-below',
  TO_ABOVE: 'to-above',
  TO_BELOW: 'to-below',
} as const;

export type SupportTransitionDirection =
  (typeof SUPPORT_TRANSITION_DIRECTION)[keyof typeof SUPPORT_TRANSITION_DIRECTION];

export type SupportPresentationState = {
  renderedState: SupportContentState;
  leavingState: SupportContentState;
  renderedErrors: readonly ValidationError.WithOptionalFieldTree[];
  frozenErrorColor: string | null;
  errorDirection: SupportTransitionDirection;
  hintDirection: SupportTransitionDirection;
};

export type ReduceSupportPresentationInput = {
  presentation: SupportPresentationState;
  semanticSupportState: SupportContentState;
  errors: readonly ValidationError.WithOptionalFieldTree[];
  currentErrorColor: string | null;
};

export const INITIAL_SUPPORT_PRESENTATION_STATE: SupportPresentationState = {
  renderedState: SUPPORT_CONTENT_STATE.NONE,
  leavingState: SUPPORT_CONTENT_STATE.NONE,
  renderedErrors: [],
  frozenErrorColor: null,
  errorDirection: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
  hintDirection: SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE,
};

export const supportPresentationIncludesState = ({
  presentation,
  state,
}: {
  presentation: SupportPresentationState;
  state: SupportContentState;
}) => {
  return presentation.renderedState === state || presentation.leavingState === state;
};

/**
 * Advances the presentation state for the newly-resolved `semanticSupportState`, deciding what
 * (if anything) is now leaving and in which direction, and freezing the leaving error's painted
 * color so it doesn't recolor mid-exit.
 */
export const reduceSupportPresentation = ({
  presentation,
  semanticSupportState,
  errors,
  currentErrorColor,
}: ReduceSupportPresentationInput): SupportPresentationState => {
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
