import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { AutoSurfaceDirective } from '@ethlete/core';
import { CASCADER_IMPORTS } from '../cascader/cascader.imports';
import { CHECKBOX_IMPORTS } from '../checkbox/checkbox.imports';
import { CHOICE_FIELD_IMPORTS } from '../choice-field/choice-field.imports';
import { COLOR_INPUT_IMPORTS } from '../color-input/color-input.imports';
import { DATE_INPUT_IMPORTS } from '../date-time/date-input/date-input.imports';
import { DATE_RANGE_INPUT_IMPORTS } from '../date-time/date-range-input/date-range-input.imports';
import { DATE_TIME_INPUT_IMPORTS } from '../date-time/date-time-input/date-time-input.imports';
import { DATE_TIME_RANGE_INPUT_IMPORTS } from '../date-time/date-time-range-input/date-time-range-input.imports';
import { DURATION_INPUT_IMPORTS } from '../date-time/duration-input/duration-input.imports';
import { DateRangeValue } from '../date-time/internals/date-range-picker-input.directive';
import { TIME_INPUT_IMPORTS } from '../date-time/time-input/time-input.imports';
import { TIME_RANGE_INPUT_IMPORTS } from '../date-time/time-range-input/time-range-input.imports';
import { DESCRIPTION_IMPORTS } from '../description/description.imports';
import { DROPZONE_IMPORTS } from '../dropzone/dropzone.imports';
import { FORM_FIELD_IMPORTS } from '../form-field/form-field.imports';
import { INPUT_IMPORTS, NUMBER_INPUT_IMPORTS, PASSWORD_INPUT_IMPORTS } from '../input/input.imports';
import { MASKED_INPUT_IMPORTS } from '../masked-input/masked-input.imports';
import { OTP_INPUT_IMPORTS } from '../otp-input/otp-input.imports';
import { PHONE_INPUT_IMPORTS } from '../phone-input/phone-input.imports';
import { RATING_IMPORTS } from '../rating/rating.imports';
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor/rich-text-editor.imports';
import { SELECT_IMPORTS } from '../select/select.imports';
import {
  CHECKBOX_GROUP_IMPORTS,
  RADIO_GROUP_IMPORTS,
  SEGMENTED_BUTTON_IMPORTS,
} from '../selection-list/selection-list.imports';
import { SLIDER_IMPORTS } from '../slider/slider.imports';
import { SWITCH_IMPORTS } from '../switch/switch.imports';
import { TAG_INPUT_IMPORTS } from '../tag-input/tag-input.imports';
import { TEXTAREA_IMPORTS } from '../textarea/textarea.imports';
import {
  FRUIT_OPTIONS,
  PLAN_OPTIONS,
  TOPPING_OPTIONS,
  VIEW_MODE_OPTIONS,
  cascaderSource,
  dropzoneUpload,
} from './control-states-storybook.data';

export const CONTROL_STATES = ['default', 'readonly', 'disabled', 'mixed'] as const;

export type ControlState = (typeof CONTROL_STATES)[number];

const STATE_HEADINGS: Record<ControlState, string> = {
  default: 'Default',
  readonly: 'Readonly',
  disabled: 'Disabled',
  mixed: 'Mixed',
};

const DATE_RANGE: DateRangeValue = { start: '2026-12-24', end: '2026-12-31' };
const TIME_RANGE: DateRangeValue = { start: '09:00', end: '17:30' };
const DATE_TIME_RANGE: DateRangeValue = { start: '2026-07-16T09:00:00Z', end: '2026-07-16T17:30:00Z' };

/**
 * One column of every form control, driven by a single form whose disabled/readonly state the
 * column owns. The state pass renders three of these side by side, so a regression in one state
 * is visible next to the two it has to differ from.
 */
@Component({
  selector: 'et-sb-control-states-column',
  template: `
    <div class="flex flex-col gap-6">
      <h2 class="text-medium font-sans font-medium">{{ heading() }}</h2>

      <et-form-field>
        <et-label>Input</et-label>
        <et-input [mixed]="mixed()" [formField]="demoForm.text" placeholder="Placeholder" />
        <et-hint>A plain text field</et-hint>
      </et-form-field>

      <et-form-field>
        <et-label>Masked input</et-label>
        <et-input [mixed]="mixed()" [formField]="demoForm.masked" etInputMask="00-00-0000" placeholder="dd-mm-yyyy" />
      </et-form-field>

      <et-form-field>
        <et-label>Number input</et-label>
        <et-number-input [mixed]="mixed()" [formField]="demoForm.number" [step]="1" stepper />
      </et-form-field>

      <et-form-field>
        <et-label>Password input</et-label>
        <et-password-input [mixed]="mixed()" [formField]="demoForm.password" autocomplete="new-password" />
      </et-form-field>

      <et-form-field>
        <et-label>Textarea</et-label>
        <et-textarea [mixed]="mixed()" [formField]="demoForm.textarea" [rows]="2" placeholder="Placeholder" />
      </et-form-field>

      <et-form-field>
        <et-label>Select</et-label>
        <et-select [mixed]="mixed()" [formField]="demoForm.select" placeholder="Pick a fruit">
          @for (fruit of FRUITS; track fruit.value) {
            <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
          }
        </et-select>
      </et-form-field>

      <et-form-field>
        <et-label>Select (multiple, searchable)</et-label>
        <et-select [mixed]="mixed()" [formField]="demoForm.multiSelect" placeholder="Pick fruits" multiple>
          <input etSelectSearch placeholder="Search fruits" />
          @for (fruit of FRUITS; track fruit.value) {
            <et-select-option [value]="fruit.value">{{ fruit.label }}</et-select-option>
          }
        </et-select>
      </et-form-field>

      <et-form-field>
        <et-label>Cascader</et-label>
        <et-cascader
          [mixed]="mixed()"
          [formField]="demoForm.cascader"
          [dataSource]="SOURCE"
          placeholder="Pick a stage"
        />
      </et-form-field>

      <et-form-field>
        <et-label>Color input</et-label>
        <et-color-input [mixed]="mixed()" [formField]="demoForm.color" />
      </et-form-field>

      <et-form-field>
        <et-label>Date input</et-label>
        <et-date-input
          [mixed]="mixed()"
          [formField]="demoForm.date"
          valueFormat="yyyy-MM-dd"
          placeholder="mm/dd/yyyy"
        />
      </et-form-field>

      <et-form-field>
        <et-label>Time input</et-label>
        <et-time-input [mixed]="mixed()" [formField]="demoForm.time" valueFormat="HH:mm" placeholder="hh:mm" />
      </et-form-field>

      <et-form-field>
        <et-label>Date time input</et-label>
        <et-date-time-input [mixed]="mixed()" [formField]="demoForm.dateTime" placeholder="mm/dd/yyyy, hh:mm" />
      </et-form-field>

      <et-form-field>
        <et-label>Duration input</et-label>
        <et-duration-input
          [mixed]="mixed()"
          [formField]="demoForm.duration"
          durationFormat="mm:ss"
          placeholder="mm:ss"
        />
      </et-form-field>

      <et-form-field>
        <et-label>Date range input</et-label>
        <et-date-range-input [mixed]="mixed()" [formField]="demoForm.dateRange" valueFormat="yyyy-MM-dd" />
      </et-form-field>

      <et-form-field>
        <et-label>Time range input</et-label>
        <et-time-range-input [mixed]="mixed()" [formField]="demoForm.timeRange" valueFormat="HH:mm" />
      </et-form-field>

      <et-form-field>
        <et-label>Date time range input</et-label>
        <et-date-time-range-input [mixed]="mixed()" [formField]="demoForm.dateTimeRange" />
      </et-form-field>

      <et-form-field>
        <et-label>Phone input</et-label>
        <et-phone-input [mixed]="mixed()" [formField]="demoForm.phone" placeholder="123 4567890" />
      </et-form-field>

      <et-form-field>
        <et-label>Tag input</et-label>
        <et-tag-input [mixed]="mixed()" [formField]="demoForm.tags" placeholder="Add a tag" />
      </et-form-field>

      <et-form-field style="--et-rich-text-editor-min-height: 90px">
        <et-label>Rich text editor</et-label>
        <et-rich-text-editor [formField]="demoForm.richText" placeholder="Write something…" />
      </et-form-field>

      <et-otp-input [formField]="demoForm.otp" [length]="4">
        <et-label>OTP input</et-label>
      </et-otp-input>

      <et-slider [mixed]="mixed()" [formField]="demoForm.slider">
        <et-label>Slider</et-label>
        <ng-template etSliderThumbLabel let-value>{{ value }}</ng-template>
      </et-slider>

      <et-range-slider [mixed]="mixed()" [formField]="demoForm.rangeSlider">
        <et-label>Range slider</et-label>
      </et-range-slider>

      <et-rating [mixed]="mixed()" [formField]="demoForm.rating">
        <et-label>Rating</et-label>
      </et-rating>

      <et-choice-field>
        <et-checkbox [indeterminate]="mixed()" [formField]="demoForm.checkbox" />
        <et-label>Checkbox</et-label>
        <et-hint>A plain checkbox</et-hint>
      </et-choice-field>

      <et-choice-field variant="card">
        <et-checkbox [indeterminate]="mixed()" [formField]="demoForm.checkboxCard" />
        <et-label>Checkbox (card)</et-label>
        <et-hint>A card-variant checkbox</et-hint>
      </et-choice-field>

      <et-choice-field>
        <et-switch [indeterminate]="mixed()" [formField]="demoForm.switch" />
        <et-label>Switch</et-label>
      </et-choice-field>

      <et-radio-group [mixed]="mixed()" [formField]="demoForm.radio">
        <et-label>Radio group</et-label>
        @for (plan of PLANS; track plan.value) {
          <et-radio [value]="plan.value">{{ plan.label }}</et-radio>
        }
      </et-radio-group>

      <et-radio-group [mixed]="mixed()" [formField]="demoForm.radioCard">
        <et-label>Radio group (card)</et-label>
        @for (plan of PLANS; track plan.value) {
          <et-radio [value]="plan.value" variant="card">
            {{ plan.label }}
            <et-description>{{ plan.description }}</et-description>
          </et-radio>
        }
      </et-radio-group>

      <et-checkbox-group [mixed]="mixed()" [formField]="demoForm.toppings">
        <et-label>Checkbox group</et-label>
        <et-checkbox-group-select-all />
        @for (topping of TOPPINGS; track topping.value) {
          <et-checkbox-option [value]="topping.value">{{ topping.label }}</et-checkbox-option>
        }
      </et-checkbox-group>

      <et-segmented-button-group [mixed]="mixed()" [formField]="demoForm.viewMode">
        <et-label>Segmented button group</et-label>
        @for (mode of VIEW_MODES; track mode.value) {
          <et-segmented-button [value]="mode.value">{{ mode.label }}</et-segmented-button>
        }
      </et-segmented-button-group>

      <et-dropzone [formField]="demoForm.media" [upload]="UPLOAD" multiple>
        <et-label>Dropzone</et-label>
      </et-dropzone>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    ...NUMBER_INPUT_IMPORTS,
    ...PASSWORD_INPUT_IMPORTS,
    ...MASKED_INPUT_IMPORTS,
    ...TEXTAREA_IMPORTS,
    ...SELECT_IMPORTS,
    ...CASCADER_IMPORTS,
    ...COLOR_INPUT_IMPORTS,
    ...DATE_INPUT_IMPORTS,
    ...TIME_INPUT_IMPORTS,
    ...DATE_TIME_INPUT_IMPORTS,
    ...DURATION_INPUT_IMPORTS,
    ...DATE_RANGE_INPUT_IMPORTS,
    ...TIME_RANGE_INPUT_IMPORTS,
    ...DATE_TIME_RANGE_INPUT_IMPORTS,
    ...PHONE_INPUT_IMPORTS,
    ...TAG_INPUT_IMPORTS,
    ...RICH_TEXT_EDITOR_IMPORTS,
    ...OTP_INPUT_IMPORTS,
    ...SLIDER_IMPORTS,
    ...RATING_IMPORTS,
    ...CHOICE_FIELD_IMPORTS,
    ...CHECKBOX_IMPORTS,
    ...SWITCH_IMPORTS,
    ...RADIO_GROUP_IMPORTS,
    ...CHECKBOX_GROUP_IMPORTS,
    ...SEGMENTED_BUTTON_IMPORTS,
    ...DESCRIPTION_IMPORTS,
    ...DROPZONE_IMPORTS,
    FormField,
  ],
})
export class ControlStatesColumnStorybookComponent {
  public heading = input('Default');
  public disabled = input(false);
  public readonly = input(false);
  public mixed = input(false);

  protected readonly FRUITS = FRUIT_OPTIONS;
  protected readonly PLANS = PLAN_OPTIONS;
  protected readonly TOPPINGS = TOPPING_OPTIONS;
  protected readonly VIEW_MODES = VIEW_MODE_OPTIONS;
  protected readonly SOURCE = cascaderSource;
  protected readonly UPLOAD = dropzoneUpload;

  private formModel = signal({
    text: 'Some text',
    masked: '24122026',
    number: 42 as number | null,
    password: 'hunter2hunter2',
    textarea: 'Some longer text',
    select: 'apple' as string | null,
    multiSelect: ['apple', 'fig'] as string[],
    cascader: 'euro-ko' as string | null,
    color: '#3b82f6' as string | null,
    date: '2026-12-24' as string | null,
    time: '14:30' as string | null,
    dateTime: '2026-07-16T14:30:00Z' as string | null,
    duration: 90_000 as number | null,
    dateRange: DATE_RANGE,
    timeRange: TIME_RANGE,
    dateTimeRange: DATE_TIME_RANGE,
    phone: '+49 151 23456789',
    tags: ['alpha', 'beta'],
    richText: '<p>Some rich text</p>',
    otp: '1234',
    slider: 40,
    rangeSlider: [20, 80] as [number, number],
    rating: 3 as number | null,
    checkbox: true,
    checkboxCard: true,
    switch: true,
    radio: 'pro' as string | null,
    radioCard: 'pro' as string | null,
    toppings: ['cheese'] as string[],
    viewMode: 'grid' as string | null,
    media: [] as string[],
  });

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s, () => this.readonly());
  });
}

/** The three-column pass: the same controls in their default, readonly and disabled states. */
@Component({
  selector: 'et-sb-control-states',
  template: `
    <div class="flex gap-8 p-8 font-sans">
      @for (column of columns(); track column.heading) {
        <et-sb-control-states-column
          [heading]="column.heading"
          [disabled]="column.disabled"
          [readonly]="column.readonly"
          [mixed]="column.mixed"
          [style.max-inline-size.px]="420"
          class="min-w-0 flex-1"
        />
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ControlStatesColumnStorybookComponent],
})
export class ControlStatesStorybookComponent {
  public states = input<ControlState[]>([...CONTROL_STATES]);

  protected columns = computed(() =>
    this.states().map((state) => ({
      heading: STATE_HEADINGS[state],
      disabled: state === 'disabled',
      readonly: state === 'readonly',
      mixed: state === 'mixed',
    })),
  );
}

/**
 * The focus pass: the same controls, with a live readout of what holds focus and whether the browser
 * is painting its ring. Only one element can hold real focus, so the focus look is reviewed by
 * tabbing rather than side by side - and Tab order is what a keyboard user actually gets.
 */
@Component({
  selector: 'et-sb-control-states-focus',
  template: `
    <div class="flex flex-col font-sans">
      <div
        class="sticky top-0 z-10 flex flex-col gap-1 border-b px-8 py-4"
        style="background: var(--et-surface-background-solid); border-color: var(--et-surface-border-solid)"
        etAutoSurface
      >
        @if (focused(); as state) {
          <p class="text-medium font-medium">{{ state.name }}</p>
          <p class="text-small opacity-70">{{ state.element }} — focus ring {{ state.ring ? 'shown' : 'hidden' }}</p>
        } @else {
          <p class="text-medium font-medium">Press Tab to walk the controls</p>
          <p class="text-small opacity-70">
            A browser paints the focus ring for keyboard focus only, so a click focuses without one.
          </p>
        }
      </div>

      <et-sb-control-states-column [style.max-inline-size.px]="420" class="p-8" heading="Focus walk" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ControlStatesColumnStorybookComponent, AutoSurfaceDirective],
  host: {
    '(focusin)': 'readFocus($event)',
    '(focusout)': 'focused.set(null)',
  },
})
export class ControlStatesFocusStorybookComponent {
  protected focused = signal<{ name: string; element: string; ring: boolean } | null>(null);

  protected readFocus(event: FocusEvent) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    this.focused.set({
      name: this.controlName(target),
      element: target.tagName.toLowerCase() + (target.className ? '.' + target.className.split(' ')[0] : ''),
      ring: target.matches(':focus-visible'),
    });
  }

  /** The `<et-label>` of the block the focused element sits in - what a reviewer recognises it by. */
  private controlName(target: HTMLElement) {
    // eslint-disable-next-line ethlete/no-dom-query -- naming an arbitrary focused node: the block it belongs to is a DOM ancestor relationship, and the 30 controls share no token to ask instead
    const block = target.closest(
      'et-form-field, et-choice-field, [role="radiogroup"], [role="group"], et-slider, et-range-slider, et-rating, et-otp-input, et-dropzone',
    );

    // eslint-disable-next-line ethlete/no-dom-query -- see above
    return block?.querySelector('et-label')?.textContent?.trim() || target.getAttribute('aria-label') || 'Unnamed';
  }
}
