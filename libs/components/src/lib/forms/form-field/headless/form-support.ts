import {
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  runInInjectionContext,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import {
  AnimatableDirective,
  defineProvider,
  injectErrorTheme,
  injectWarningTheme,
  ProvideColorDirective,
  signalElementDimensions,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { FormFieldDirective } from './form-field.directive';
import {
  clearLeavingSupportStateOnExit,
  INITIAL_SUPPORT_PRESENTATION_STATE,
  reduceSupportPresentation,
  SUPPORT_CONTENT_STATE,
  SupportContentState,
} from './support-presentation';

const formSupportFactory = () => {
  const provideColor = inject(ProvideColorDirective, { optional: true });
  const formFieldDir = inject(FormFieldDirective);
  const injector = inject(Injector);
  const errorColorTheme = injectErrorTheme();

  const errorContent = signal<ElementRef<HTMLElement> | undefined>(undefined);
  const warningContent = signal<ElementRef<HTMLElement> | undefined>(undefined);
  const hintContent = signal<ElementRef<HTMLElement> | undefined>(undefined);
  const errorAnimatable = signal<AnimatableDirective | undefined>(undefined);
  const warningAnimatable = signal<AnimatableDirective | undefined>(undefined);
  const hintAnimatable = signal<AnimatableDirective | undefined>(undefined);

  const errorDimensions = signalElementDimensions(errorContent);
  const warningDimensions = signalElementDimensions(warningContent);
  const hintDimensions = signalElementDimensions(hintContent);

  const semanticSupportState = computed<SupportContentState>(() => {
    if (formFieldDir.shouldDisplayError() && formFieldDir.errors().length > 0) {
      return SUPPORT_CONTENT_STATE.ERROR;
    }

    if (formFieldDir.warnings().length > 0) {
      return SUPPORT_CONTENT_STATE.WARNING;
    }

    if (formFieldDir.registeredHint()) {
      return SUPPORT_CONTENT_STATE.HINT;
    }

    return SUPPORT_CONTENT_STATE.NONE;
  });

  const displaysError = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  const displaysWarning = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING);

  // the enter/leave state machine is shared with the text-field shell - see
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

  const shouldRenderWarning = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING ||
      supportPresentation().leavingState === SUPPORT_CONTENT_STATE.WARNING
    );
  });

  const shouldRenderHint = computed(() => {
    return (
      semanticSupportState() === SUPPORT_CONTENT_STATE.HINT ||
      supportPresentation().leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  const errorActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  const warningActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING);
  const hintActive = computed(() => semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);

  // resolved only once a warning renders, so a control that never warns doesn't force the app to
  // register a `type: 'warning'` theme
  const warningColorTheme = computed(() =>
    shouldRenderWarning() ? runInInjectionContext(injector, injectWarningTheme) : null,
  );

  const visibleErrors = computed(() => {
    if (semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR) {
      return formFieldDir.errors();
    }

    return supportPresentation().renderedErrors;
  });

  const visibleWarnings = computed(() => {
    if (semanticSupportState() === SUPPORT_CONTENT_STATE.WARNING) {
      return formFieldDir.warnings();
    }

    return supportPresentation().renderedWarnings;
  });

  const supportHeight = computed(() => {
    switch (semanticSupportState()) {
      case SUPPORT_CONTENT_STATE.ERROR:
        return errorDimensions().offset?.height ?? 0;
      case SUPPORT_CONTENT_STATE.WARNING:
        return warningDimensions().offset?.height ?? 0;
      case SUPPORT_CONTENT_STATE.HINT:
        return hintDimensions().offset?.height ?? 0;
      default:
        return 0;
    }
  });

  for (const [state, animatable] of [
    [SUPPORT_CONTENT_STATE.ERROR, errorAnimatable],
    [SUPPORT_CONTENT_STATE.WARNING, warningAnimatable],
    [SUPPORT_CONTENT_STATE.HINT, hintAnimatable],
  ] as const) {
    clearLeavingSupportStateOnExit({ state, animatable, presentation: supportPresentation, semanticSupportState });
  }

  effect(() => {
    const state = semanticSupportState();
    const errors = formFieldDir.errors();
    const warnings = formFieldDir.warnings();

    supportPresentation.update((presentation) =>
      reduceSupportPresentation({ presentation, semanticSupportState: state, errors, warnings }),
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
    warningColorTheme,
    formFieldDir,
    // the support region a control's `aria-describedby` points at has to carry the matching id,
    // or the message it names resolves to nothing and is never announced
    errorId: formFieldDir.errorId,
    warningId: formFieldDir.warningId,
    hintId: formFieldDir.hintId,
    errorContent,
    warningContent,
    hintContent,
    errorAnimatable,
    warningAnimatable,
    hintAnimatable,
    semanticSupportState,
    displaysError,
    displaysWarning,
    shouldRenderSupport,
    shouldRenderError,
    shouldRenderWarning,
    shouldRenderHint,
    errorActive,
    warningActive,
    hintActive,
    visibleErrors,
    visibleWarnings,
    supportHeight,
  };
};

const FORM_SUPPORT_DEF = /* @__PURE__ */ defineProvider(formSupportFactory, {
  name: 'FormSupport',
});

export const provideFormSupport = /* @__PURE__ */ toProvideFn(FORM_SUPPORT_DEF);
export const injectFormSupport = /* @__PURE__ */ toInjectFn(FORM_SUPPORT_DEF);

export type FormSupport = ReturnType<typeof formSupportFactory>;

/**
 * Forwards a component's support-region view children into its `FormSupport`. The `viewChild`
 * queries themselves must stay as class fields (`NG8110` - the compiler only accepts them in
 * direct field initializers); this owns the wiring so the mapping lives in one place. Call
 * from the constructor (needs an injection context for the effect).
 */
export const wireFormSupport = (
  support: FormSupport,
  refs: {
    errorContent: Signal<ElementRef<HTMLElement> | undefined>;
    warningContent: Signal<ElementRef<HTMLElement> | undefined>;
    hintContent: Signal<ElementRef<HTMLElement> | undefined>;
    errorAnimatable: Signal<AnimatableDirective | undefined>;
    warningAnimatable: Signal<AnimatableDirective | undefined>;
    hintAnimatable: Signal<AnimatableDirective | undefined>;
  },
) => {
  effect(() => {
    support.errorContent.set(refs.errorContent());
    support.warningContent.set(refs.warningContent());
    support.hintContent.set(refs.hintContent());
    support.errorAnimatable.set(refs.errorAnimatable());
    support.warningAnimatable.set(refs.warningAnimatable());
    support.hintAnimatable.set(refs.hintAnimatable());
  });
};
