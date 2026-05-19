import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ValidationError } from '@angular/forms/signals';
import {
  AnimatableDirective,
  createCanAnimateSignal,
  injectErrorTheme,
  ProvideColorDirective,
  signalElementDimensions,
} from '@ethlete/core';
import { EMPTY, filter, switchMap, tap } from 'rxjs';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective } from '../form-field/headless';

const SUPPORT_CONTENT_STATE = {
  NONE: 'none',
  HINT: 'hint',
  ERROR: 'error',
} as const;

type SupportContentState = (typeof SUPPORT_CONTENT_STATE)[keyof typeof SUPPORT_CONTENT_STATE];

@Component({
  selector: 'et-choice-field',
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatableDirective, FormErrorComponent],
  hostDirectives: [FormFieldDirective, { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] }],
  host: {
    class: 'et-choice-field',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'displaysError() || null',
  },
})
export class ChoiceFieldComponent {
  private provideColor = inject(ProvideColorDirective);

  protected formFieldDir = inject(FormFieldDirective);

  protected errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  protected hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  protected errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  protected hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');

  private errorColorTheme = injectErrorTheme();

  private errorDimensions = signalElementDimensions(this.errorContent);
  private hintDimensions = signalElementDimensions(this.hintContent);

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

  private supportState = signal<{
    renderedErrors: readonly ValidationError.WithOptionalFieldTree[];
    leavingState: SupportContentState;
    frozenErrorColor: string | null;
  }>({ renderedErrors: [], leavingState: SUPPORT_CONTENT_STATE.NONE, frozenErrorColor: null });

  protected shouldRenderSupport = computed(() => {
    return (
      this.semanticSupportState() !== SUPPORT_CONTENT_STATE.NONE ||
      this.supportState().leavingState !== SUPPORT_CONTENT_STATE.NONE
    );
  });

  protected shouldRenderError = computed(() => {
    return (
      this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR ||
      this.supportState().leavingState === SUPPORT_CONTENT_STATE.ERROR
    );
  });

  protected shouldRenderHint = computed(() => {
    return (
      this.semanticSupportState() === SUPPORT_CONTENT_STATE.HINT ||
      this.supportState().leavingState === SUPPORT_CONTENT_STATE.HINT
    );
  });

  protected errorActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR);
  protected hintActive = computed(() => this.semanticSupportState() === SUPPORT_CONTENT_STATE.HINT);

  protected visibleErrors = computed(() => {
    if (this.semanticSupportState() === SUPPORT_CONTENT_STATE.ERROR) {
      return this.formFieldDir.errors();
    }

    return this.supportState().renderedErrors;
  });

  protected errorColor = computed(() => this.supportState().frozenErrorColor);

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
        switchMap((animatable) => (animatable ? animatable.animationEnd$ : EMPTY)),
        filter(() => {
          return (
            this.supportState().leavingState === SUPPORT_CONTENT_STATE.ERROR &&
            this.semanticSupportState() !== SUPPORT_CONTENT_STATE.ERROR
          );
        }),
        tap(() => {
          this.supportState.update((s) => ({
            ...s,
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
        switchMap((animatable) => (animatable ? animatable.animationEnd$ : EMPTY)),
        filter(() => {
          return (
            this.supportState().leavingState === SUPPORT_CONTENT_STATE.HINT &&
            this.semanticSupportState() !== SUPPORT_CONTENT_STATE.HINT
          );
        }),
        tap(() => {
          this.supportState.update((s) => ({ ...s, leavingState: SUPPORT_CONTENT_STATE.NONE }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const state = this.semanticSupportState();
      const errors = this.formFieldDir.errors();
      const errorContent = this.errorContent()?.nativeElement;
      const currentErrorColor = errorContent ? getComputedStyle(errorContent).color : null;

      this.supportState.update((s) => {
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
            : this.formFieldDir.registeredHint()
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
      const showError = this.displaysError();

      untracked(() => {
        if (showError) {
          this.provideColor.forceMainColor(this.errorColorTheme);

          return;
        }

        this.provideColor.clearForcedMainColor();
      });
    });
  }
}
