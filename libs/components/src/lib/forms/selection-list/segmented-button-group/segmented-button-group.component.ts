import { Component, computed, effect, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { createCanAnimateSignal, injectStyleManager, ProvideColorDirective } from '@ethlete/core';
import { TabScaleStylesComponent } from '../../../tabs/tab-scale-styles.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../../form-field/form-field.variants';
import { FormSupportComponent } from '../../form-field/partials/form-support.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../../form-field/headless';
import { SelectionListDirective } from '../headless';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

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
  imports: [FormSupportComponent],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SelectionListDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-segmented-button-group',
    '[class.et-tab-scale]': 'isTabsVariant()',
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
  },
})
export class SegmentedButtonGroupComponent {
  private list = inject(SelectionListDirective);
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

  protected isTabsVariant = computed(() => this.variant() === SEGMENTED_BUTTON_GROUP_VARIANTS.TABS);

  /** @internal The active background element of the currently checked button. Used as the flip animation origin. */
  public lastActiveBackgroundElement = signal<HTMLElement | null>(null);
  public canAnimate = createCanAnimateSignal();

  constructor() {
    const styleManager = injectStyleManager();

    effect(() => {
      if (this.isTabsVariant()) {
        styleManager.mount(TabScaleStylesComponent);
      }
    });
  }

  public focus(options?: FocusOptions) {
    this.list.focus(options);
  }
}
