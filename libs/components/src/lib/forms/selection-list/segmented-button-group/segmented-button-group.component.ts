import { Component, ElementRef, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FormErrorComponent } from '../../form-field/form-error.component';
import { FormWarningComponent } from '../../form-field/form-warning.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../../form-field/headless';
import { SelectionListDirective } from '../headless';

/** How a segmented button group presents its selection. See {@link SegmentedButtonGroupComponent.variant}. */
export const SEGMENTED_BUTTON_GROUP_VARIANTS = {
  PILL: 'pill',
  TABS: 'tabs',
} as const;

export type SegmentedButtonGroupVariant =
  (typeof SEGMENTED_BUTTON_GROUP_VARIANTS)[keyof typeof SEGMENTED_BUTTON_GROUP_VARIANTS];

@Component({
  selector: 'et-segmented-button-group',
  templateUrl: './segmented-button-group.component.html',
  styleUrl: './segmented-button-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, FormWarningComponent, ProvideColorDirective],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SelectionListDirective,
      inputs: ['value', 'mixed', 'touched', 'disabled', 'readonly', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-segmented-button-group',
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
  },
})
export class SegmentedButtonGroupComponent {
  public support = injectFormSupport();
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  /**
   * How the selection is drawn. `'pill'` fills the selected segment; `'tabs'` underlines it instead, for a group
   * that reads as a set of views rather than a set of values.
   *
   * It is still a **selection control**, not navigation - it binds to a form field and announces itself as a radio
   * group. If the segments correspond to routes, or to panels of content that should be linkable, reach for
   * [tabs](/components/tabs) instead; this variant is for a filter that happens to look like tabs. @default 'pill'
   */
  public variant = input<SegmentedButtonGroupVariant>(SEGMENTED_BUTTON_GROUP_VARIANTS.PILL);

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private warningContentRef = viewChild<ElementRef<HTMLElement>>('warningContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private warningAnimatableRef = viewChild<AnimatableDirective>('warningAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');

  /** @internal The active background element of the currently checked button. Used as the flip animation origin. */
  public lastActiveBackgroundElement = signal<HTMLElement | null>(null);
  public canAnimate = createCanAnimateSignal();

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContentRef,
      warningContent: this.warningContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      warningAnimatable: this.warningAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });
  }
}
