import {
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  AnimatableDirective,
  ColorInteractiveExcludeDirective,
  ColorInteractiveHasFocusDirective,
  createCanAnimateSignal,
  injectParentSurface,
  injectSurfaceThemes,
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
  FormFieldDirective,
  injectFormSupport,
  hitsInteractiveElement,
  provideFormSupport,
  wireFormSupport,
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
  providers: [provideFormSupport()],
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
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
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
  private provideSurface = inject(ProvideSurfaceDirective);
  private parentSurface = injectParentSurface();

  protected formFieldDir = inject(FormFieldDirective);

  public support = injectFormSupport();
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

  private prefixDimensions = signalElementDimensions(this.prefixEl);

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

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContent,
      warningContent: this.warningContent,
      hintContent: this.hintContent,
      counterContent: this.counterContent,
      errorAnimatable: this.errorAnimatable,
      warningAnimatable: this.warningAnimatable,
      hintAnimatable: this.hintAnimatable,
    });

    effect(() => {
      const element = this.controlFrame()?.nativeElement ?? null;

      untracked(() => this.formFieldDir.controlFrameElement.set(element));
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

    if (hitsInteractiveElement(event.target as HTMLElement, event.currentTarget as HTMLElement)) {
      return;
    }

    event.preventDefault();
    this.formFieldDir.activate();
  }
}
