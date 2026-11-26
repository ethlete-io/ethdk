import { Component, contentChild, effect, inject, input, ViewEncapsulation } from '@angular/core';
import {
  ColorInteractiveContainerDirective,
  ColorInteractiveDirective,
  ColorInteractiveExcludeDirective,
  createCanAnimateSignal,
  injectStyleManager,
  ProvideColorDirective,
} from '@ethlete/core';
import { ChoiceFieldCardStylesComponent } from './choice-field-card-styles.component';
import { SelectionCardStylesComponent } from '../selection-card-styles.component';
import { SELECTION_CARD_CONTROL_POSITIONS, SelectionCardControlPosition } from '../selection-card.types';
import { FormSupportComponent } from '../form-field/partials/form-support.component';
import { injectFormFieldDefaults } from '../form-field/form-field-defaults';
import { FormFieldSize } from '../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../form-field/headless';
import { DescriptionComponent } from '../description/description.component';

/** How a choice field presents itself. See {@link ChoiceFieldComponent.variant}. */
export const CHOICE_FIELD_VARIANTS = {
  PLAIN: 'plain',
  CARD: 'card',
} as const;

export type ChoiceFieldVariant = (typeof CHOICE_FIELD_VARIANTS)[keyof typeof CHOICE_FIELD_VARIANTS];

/** Which side of the control the label sits on. See {@link ChoiceFieldComponent.labelPosition}. */
export const CHOICE_FIELD_LABEL_POSITIONS = {
  START: 'start',
  END: 'end',
} as const;

export type ChoiceFieldLabelPosition = (typeof CHOICE_FIELD_LABEL_POSITIONS)[keyof typeof CHOICE_FIELD_LABEL_POSITIONS];

/** How a plain choice field lays out its parts. See {@link ChoiceFieldComponent.layout}. */
export const CHOICE_FIELD_LAYOUTS = {
  INLINE: 'inline',
  SUBGRID: 'subgrid',
} as const;

export type ChoiceFieldLayout = (typeof CHOICE_FIELD_LAYOUTS)[keyof typeof CHOICE_FIELD_LAYOUTS];

@Component({
  selector: 'et-choice-field',
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ColorInteractiveContainerDirective,
    ColorInteractiveDirective,
    ColorInteractiveExcludeDirective,
    FormSupportComponent,
  ],
  providers: [provideFormSupport()],
  hostDirectives: [FormFieldDirective, { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] }],
  host: {
    class: 'et-choice-field',
    '[style.display]': 'formField.isHidden() ? "none" : null',
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-label-position]': "variant() === 'plain' && labelPosition() === 'start' ? 'start' : null",
    '[attr.data-layout]': "variant() === 'plain' && layout() === 'subgrid' ? 'subgrid' : null",
    '[attr.data-control-position]': "variant() === 'card' ? controlPosition() : null",
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
  },
})
export class ChoiceFieldComponent {
  public support = injectFormSupport();
  protected formField = inject(FormFieldDirective);

  private styleManager = injectStyleManager();
  public size = input<FormFieldSize>(injectFormFieldDefaults().size);

  /**
   * `'card'` turns the row into a full-width clickable panel with the label leading and the control trailing - for
   * a short list of consequential options where each wants room for a hint. Works for whichever control is
   * projected, so a checkbox and a switch get the same preset. @default 'plain'
   */
  public variant = input<ChoiceFieldVariant>(CHOICE_FIELD_VARIANTS.PLAIN);

  /**
   * Which end of the card the control sits at. `'end'` keeps the label leading and the control trailing;
   * `'start'` puts the control first, ahead of any `[etSelectionCardLeading]` media. Only `variant="card"`
   * reads it. @default 'end'
   */
  public controlPosition = input<SelectionCardControlPosition>(SELECTION_CARD_CONTROL_POSITIONS.END);

  /**
   * Which side of the control the label sits on in `variant="plain"`. `'start'` puts the text before the control;
   * the DOM order and the accessible name stay the same. A card uses `controlPosition` instead. @default 'end'
   */
  public labelPosition = input<ChoiceFieldLabelPosition>(CHOICE_FIELD_LABEL_POSITIONS.END);

  /**
   * `'subgrid'` makes the field span two columns of the parent grid and places the control and the label in those
   * columns, so rows of fields line up. The parent must be a grid with at least two columns. Only
   * `variant="plain"` reads it. @default 'inline'
   */
  public layout = input<ChoiceFieldLayout>(CHOICE_FIELD_LAYOUTS.INLINE);

  private description = contentChild(DescriptionComponent);

  public canAnimate = createCanAnimateSignal();

  constructor() {
    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.formField.descriptionId.set(this.description()?.id ?? null));

    effect(() => {
      if (this.variant() === CHOICE_FIELD_VARIANTS.CARD) {
        this.styleManager.mount(SelectionCardStylesComponent);
        this.styleManager.mount(ChoiceFieldCardStylesComponent);
      }
    });
  }
}
