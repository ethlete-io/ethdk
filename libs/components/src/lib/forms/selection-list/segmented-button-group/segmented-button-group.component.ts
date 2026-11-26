import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { createCanAnimateSignal, injectStyleManager, ProvideColorDirective } from '@ethlete/core';
import { ScrollableDirective } from '../../../scrollable/headless/scrollable.directive';
import { SCROLLABLE_IMPORTS } from '../../../scrollable/scrollable.imports';
import { TabScaleStylesComponent } from '../../../tabs/tab-scale-styles.component';
import { injectFormFieldDefaults } from '../../form-field/form-field-defaults';
import { FormFieldSize } from '../../form-field/form-field.variants';
import { FormSupportComponent } from '../../form-field/partials/form-support.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../../form-field/headless';
import { SelectionListDirective } from '../headless';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';
import { FIELD_STATE_INPUTS } from '../../form-field/headless/field-state-control.directive';

/** How a segmented button group presents its selection. See {@link SegmentedButtonGroupComponent.variant}. */
export const SEGMENTED_BUTTON_GROUP_VARIANTS = {
  PILL: 'pill',
  TABS: 'tabs',
} as const;

/** How a segmented button group handles segments that do not fit. See {@link SegmentedButtonGroupComponent.overflow}. */
export const SEGMENTED_BUTTON_GROUP_OVERFLOWS = {
  TRUNCATE: 'truncate',
  SCROLL: 'scroll',
} as const;

export type SegmentedButtonGroupOverflow =
  (typeof SEGMENTED_BUTTON_GROUP_OVERFLOWS)[keyof typeof SEGMENTED_BUTTON_GROUP_OVERFLOWS];

export type SegmentedButtonGroupVariant =
  (typeof SEGMENTED_BUTTON_GROUP_VARIANTS)[keyof typeof SEGMENTED_BUTTON_GROUP_VARIANTS];

@Component({
  selector: 'et-segmented-button-group',
  templateUrl: './segmented-button-group.component.html',
  styleUrl: './segmented-button-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FormSupportComponent, SCROLLABLE_IMPORTS, NgTemplateOutlet],
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
        'pending',
        'compareWith',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-segmented-button-group',
    '[class.et-tab-scale]': 'isTabsVariant()',
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-overflow]': 'overflow()',
    '[attr.data-stretch]': 'stretch() || null',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
    '[style.display]': 'list.hidden() ? "none" : null',
    '[attr.aria-busy]': 'list.pending() ? "true" : null',
  },
})
export class SegmentedButtonGroupComponent {
  protected list = inject(SelectionListDirective);
  public support = injectFormSupport();
  public size = input<FormFieldSize>(injectFormFieldDefaults().size);

  /**
   * How the selection is drawn. `'pill'` fills the selected segment; `'tabs'` underlines it instead, for a group
   * that reads as a set of views rather than a set of values.
   *
   * It is still a **selection control**, not navigation - it binds to a form field and announces itself as a radio
   * group. If the segments correspond to routes, or to panels of content that should be linkable, reach for
   * [tabs](/components/tabs) instead; this variant is for a filter that happens to look like tabs. @default 'pill'
   */
  public variant = input<SegmentedButtonGroupVariant>(SEGMENTED_BUTTON_GROUP_VARIANTS.PILL);

  /** Gives every segment the same width and makes the group fill its container. */
  public stretch = input(false, { transform: booleanAttribute });

  /**
   * What happens when the segments are wider than the container. `'scroll'` shrinks the segments down to their full
   * label plus padding, never an ellipsis, then scrolls the track horizontally and centers the selected segment;
   * `'truncate'` shrinks every segment and cuts its label with an ellipsis. @default 'scroll'
   */
  public overflow = input<SegmentedButtonGroupOverflow>(SEGMENTED_BUTTON_GROUP_OVERFLOWS.SCROLL);

  private scrollable = viewChild(ScrollableDirective);
  protected isScrollOverflow = computed(() => this.overflow() === SEGMENTED_BUTTON_GROUP_OVERFLOWS.SCROLL);

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

    effect(() => {
      const scrollable = this.scrollable();
      const selected = this.lastActiveBackgroundElement()?.parentElement;

      if (!scrollable || !selected || !scrollable.getScrollContainerRef()()) {
        return;
      }

      scrollable.scrollToElement({ element: selected, origin: 'center' });
    });
  }

  public focus(options?: FocusOptions) {
    this.list.focus(options);
  }
}
