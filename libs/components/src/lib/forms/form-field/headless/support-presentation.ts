import { Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import { AnimatableDirective } from '@ethlete/core';
import { EMPTY, filter, switchMap, tap } from 'rxjs';
import { FieldWarning } from './field-warnings';

/**
 * The support region under a form control shows at most one of an error, a warning or a hint at a
 * time, with an animated cross-fade/slide when it switches. This module owns that little state
 * machine so the text-field shell (`form-field.component`) and the headless `injectFormSupport`
 * (rating, otp, slider, selection groups, dropzone, choice-field, …) share one implementation
 * instead of two that drift. Callers keep their own view-child wiring, error source, and derived
 * signals - only the reducer, state shape, and enum constants live here.
 */

export const SUPPORT_CONTENT_STATE = {
  NONE: 'none',
  HINT: 'hint',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type SupportContentState = (typeof SUPPORT_CONTENT_STATE)[keyof typeof SUPPORT_CONTENT_STATE];

export type SupportSwappingState = Exclude<SupportContentState, typeof SUPPORT_CONTENT_STATE.NONE>;

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
  renderedWarnings: readonly FieldWarning[];
  directions: Record<SupportSwappingState, SupportTransitionDirection>;
};

export type ReduceSupportPresentationInput = {
  presentation: SupportPresentationState;
  semanticSupportState: SupportContentState;
  errors: readonly ValidationError.WithOptionalFieldTree[];
  warnings: readonly FieldWarning[];
};

export const INITIAL_SUPPORT_PRESENTATION_STATE: SupportPresentationState = {
  renderedState: SUPPORT_CONTENT_STATE.NONE,
  leavingState: SUPPORT_CONTENT_STATE.NONE,
  renderedErrors: [],
  renderedWarnings: [],
  directions: {
    [SUPPORT_CONTENT_STATE.HINT]: SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE,
    [SUPPORT_CONTENT_STATE.WARNING]: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
    [SUPPORT_CONTENT_STATE.ERROR]: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
  },
};

/**
 * Severity order, and what the motion means: a more severe message always slides in from below and
 * pushes the less severe one up, whichever pair swaps. Entering from - or leaving to - nothing uses
 * the state's own side instead.
 */
const SUPPORT_STATE_SEVERITY: Record<SupportSwappingState, number> = {
  [SUPPORT_CONTENT_STATE.HINT]: 0,
  [SUPPORT_CONTENT_STATE.WARNING]: 1,
  [SUPPORT_CONTENT_STATE.ERROR]: 2,
};

const SUPPORT_STATE_HOME_DIRECTIONS: Record<
  SupportSwappingState,
  { entering: SupportTransitionDirection; leaving: SupportTransitionDirection }
> = {
  [SUPPORT_CONTENT_STATE.HINT]: {
    entering: SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE,
    leaving: SUPPORT_TRANSITION_DIRECTION.TO_ABOVE,
  },
  [SUPPORT_CONTENT_STATE.WARNING]: {
    entering: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
    leaving: SUPPORT_TRANSITION_DIRECTION.TO_BELOW,
  },
  [SUPPORT_CONTENT_STATE.ERROR]: {
    entering: SUPPORT_TRANSITION_DIRECTION.FROM_BELOW,
    leaving: SUPPORT_TRANSITION_DIRECTION.TO_BELOW,
  },
};

const isSwappingState = (state: SupportContentState): state is SupportSwappingState =>
  state !== SUPPORT_CONTENT_STATE.NONE;

/**
 * Drops `state` out of the presentation once its exit animation finished, so the region stops
 * rendering it and releases the messages it was holding. Call from an injection context, once per
 * swapping state.
 */
export const clearLeavingSupportStateOnExit = ({
  state,
  animatable,
  presentation,
  semanticSupportState,
}: {
  state: SupportSwappingState;
  animatable: Signal<AnimatableDirective | undefined>;
  presentation: WritableSignal<SupportPresentationState>;
  semanticSupportState: Signal<SupportContentState>;
}) => {
  toObservable(animatable)
    .pipe(
      switchMap((currentAnimatable) => (currentAnimatable ? currentAnimatable.animationEnd$ : EMPTY)),
      filter(() => presentation().leavingState === state && semanticSupportState() !== state),
      tap(() =>
        presentation.update((current) => ({
          ...current,
          leavingState: SUPPORT_CONTENT_STATE.NONE,
          renderedErrors: state === SUPPORT_CONTENT_STATE.ERROR ? [] : current.renderedErrors,
          renderedWarnings: state === SUPPORT_CONTENT_STATE.WARNING ? [] : current.renderedWarnings,
        })),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();
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

/** The message currently occupying the region, whether it is settled in or already animating out. */
const occupyingState = ({
  presentation,
  except,
}: {
  presentation: SupportPresentationState;
  except: SupportContentState;
}): SupportContentState => {
  for (const state of [presentation.renderedState, presentation.leavingState]) {
    if (state !== SUPPORT_CONTENT_STATE.NONE && state !== except) {
      return state;
    }
  }

  return SUPPORT_CONTENT_STATE.NONE;
};

/**
 * Advances the presentation state for the newly-resolved `semanticSupportState`, deciding what (if
 * anything) is now leaving and in which direction, and holding on to the messages of a state that
 * is animating out so it doesn't empty mid-exit.
 */
export const reduceSupportPresentation = ({
  presentation,
  semanticSupportState,
  errors,
  warnings,
}: ReduceSupportPresentationInput): SupportPresentationState => {
  const leavingState = occupyingState({ presentation, except: semanticSupportState });

  const directions = { ...presentation.directions };

  if (isSwappingState(semanticSupportState)) {
    directions[semanticSupportState] = isSwappingState(leavingState)
      ? SUPPORT_STATE_SEVERITY[semanticSupportState] > SUPPORT_STATE_SEVERITY[leavingState]
        ? SUPPORT_TRANSITION_DIRECTION.FROM_BELOW
        : SUPPORT_TRANSITION_DIRECTION.FROM_ABOVE
      : SUPPORT_STATE_HOME_DIRECTIONS[semanticSupportState].entering;
  }

  if (isSwappingState(leavingState)) {
    directions[leavingState] = isSwappingState(semanticSupportState)
      ? SUPPORT_STATE_SEVERITY[semanticSupportState] > SUPPORT_STATE_SEVERITY[leavingState]
        ? SUPPORT_TRANSITION_DIRECTION.TO_ABOVE
        : SUPPORT_TRANSITION_DIRECTION.TO_BELOW
      : SUPPORT_STATE_HOME_DIRECTIONS[leavingState].leaving;
  }

  const keepsState = (state: SupportSwappingState) => semanticSupportState === state || leavingState === state;

  return {
    renderedState: semanticSupportState,
    leavingState,
    renderedErrors:
      semanticSupportState === SUPPORT_CONTENT_STATE.ERROR
        ? errors
        : keepsState(SUPPORT_CONTENT_STATE.ERROR)
          ? presentation.renderedErrors
          : [],
    renderedWarnings:
      semanticSupportState === SUPPORT_CONTENT_STATE.WARNING
        ? warnings
        : keepsState(SUPPORT_CONTENT_STATE.WARNING)
          ? presentation.renderedWarnings
          : [],
    directions,
  };
};
