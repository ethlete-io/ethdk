import { ChangeDetectionStrategy, Component, computed, effect, input, signal, ViewEncapsulation } from '@angular/core';
import { disabled, email, form, FormField, maxLength, pattern, required } from '@angular/forms/signals';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { CHECKBOX_IMPORTS } from '../../checkbox';
import {
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_FILLS,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_LABEL_MODES,
  FORM_FIELD_SIZES,
  FormFieldAppearance,
  FormFieldFill,
  FormFieldLabelMode,
  FormFieldSize,
} from '../../form-field';
import { InputPrefixDirective, InputSuffixDirective } from '../../form-field/partials';
import { INPUT_IMPORTS } from '../../input';

type ShowcaseAffix = 'none' | 'prefix' | 'suffix';

type ShowcaseExample = {
  key: string;
  label: string;
  affix: ShowcaseAffix;
  placeholder: string;
};

type ShowcaseSizeGroup = {
  value: FormFieldSize;
  label: string;
  examples: ShowcaseExample[];
};

type ShowcaseAppearanceGroup = {
  appearance: FormFieldAppearance;
  fill: FormFieldFill;
  labelMode: FormFieldLabelMode;
  label: string;
  sizes: ShowcaseSizeGroup[];
};

type LabelModeExample = {
  label: string;
  mode: FormFieldLabelMode;
  placeholder: string;
};

const SHOWCASE_AFFIXES = [
  { value: 'none', label: 'None' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'suffix', label: 'Suffix' },
] as const;

const SHOWCASE_APPEARANCES = [
  { appearance: FORM_FIELD_APPEARANCES.BOX, fill: FORM_FIELD_FILLS.TRANSPARENT, label: 'Box Transparent' },
  { appearance: FORM_FIELD_APPEARANCES.BOX, fill: FORM_FIELD_FILLS.FILLED, label: 'Box Filled' },
  {
    appearance: FORM_FIELD_APPEARANCES.UNDERLINE,
    fill: FORM_FIELD_FILLS.TRANSPARENT,
    label: 'Underline Transparent',
  },
  { appearance: FORM_FIELD_APPEARANCES.UNDERLINE, fill: FORM_FIELD_FILLS.FILLED, label: 'Underline Filled' },
] as const;

const SHOWCASE_SIZES = [
  { value: FORM_FIELD_SIZES.SM, label: 'Small' },
  { value: FORM_FIELD_SIZES.MD, label: 'Medium' },
  { value: FORM_FIELD_SIZES.LG, label: 'Large' },
] as const;

const LABEL_MODE_EXAMPLES: LabelModeExample[] = [
  {
    label: 'Static Label',
    mode: FORM_FIELD_LABEL_MODES.STATIC,
    placeholder: 'Current stacked label',
  },
  {
    label: 'Inline Label',
    mode: FORM_FIELD_LABEL_MODES.INLINE,
    placeholder: 'Label as inline prefix',
  },
  {
    label: 'Floating Inside',
    mode: FORM_FIELD_LABEL_MODES.FLOATING_INSIDE,
    placeholder: 'Label floats inside the frame',
  },
  {
    label: 'Floating Outside',
    mode: FORM_FIELD_LABEL_MODES.FLOATING_OUTSIDE,
    placeholder: 'Label escapes the frame',
  },
] as const;

const SHOWCASE_LABEL_MODES = [
  { value: FORM_FIELD_LABEL_MODES.STATIC, label: 'Static' },
  { value: FORM_FIELD_LABEL_MODES.INLINE, label: 'Inline' },
  { value: FORM_FIELD_LABEL_MODES.FLOATING_INSIDE, label: 'Float Inside' },
  { value: FORM_FIELD_LABEL_MODES.FLOATING_OUTSIDE, label: 'Float Outside' },
] as const;

const createShowcaseFieldKey = ({
  appearance,
  fill,
  size,
  affix,
  labelMode,
}: {
  appearance: FormFieldAppearance;
  fill: FormFieldFill;
  size: FormFieldSize;
  affix: ShowcaseAffix;
  labelMode: FormFieldLabelMode;
}) => `${appearance}-${fill}-${labelMode}-${size}-${affix}`;

const SHOWCASE_SECTIONS: ShowcaseAppearanceGroup[] = SHOWCASE_APPEARANCES.flatMap((appearance) =>
  SHOWCASE_LABEL_MODES.map((labelMode) => ({
    appearance: appearance.appearance,
    fill: appearance.fill,
    labelMode: labelMode.value,
    label: `${appearance.label} · ${labelMode.label}`,
    sizes: SHOWCASE_SIZES.map((size) => ({
      value: size.value,
      label: size.label,
      examples: SHOWCASE_AFFIXES.map((affix) => ({
        key: createShowcaseFieldKey({
          appearance: appearance.appearance,
          fill: appearance.fill,
          size: size.value,
          affix: affix.value,
          labelMode: labelMode.value,
        }),
        label: affix.label,
        affix: affix.value,
        placeholder: `${appearance.label} ${size.label}`,
      })),
    })),
  })),
);

const SHOWCASE_FORM_MODEL = SHOWCASE_SECTIONS.reduce<Record<string, string>>((model, appearance) => {
  appearance.sizes.forEach((size) => {
    size.examples.forEach((example) => {
      model[example.key] = '';
    });
  });

  return model;
}, {});
@Component({
  selector: 'et-sb-form-field-input',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>Email address</et-label>
        <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
        <et-hint>We'll never share your email.</et-hint>
      </et-form-field>

      <et-form-field>
        <et-label>Username</et-label>
        <et-input [formField]="demoForm.username" type="text" placeholder="Enter username" />
        <et-hint>Must be between 3 and 20 characters.</et-hint>
      </et-form-field>

      <p class="text-xs text-et-surface-muted">
        Blur a field to trigger validation. Email must be valid, username is required.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, FormField],
})
export class FormFieldInputStorybookComponent {
  private formModel = signal({
    email: '',
    username: '',
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.email, { message: 'Email is required' });
    email(s.email, { message: 'Enter a valid email address' });
    required(s.username, { message: 'Username is required' });
  });
}

@Component({
  selector: 'et-sb-form-field-username-hint',
  template: `
    <div class="flex max-w-xs flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>Username</et-label>
        <et-input [formField]="demoForm.username" type="text" placeholder="Your username" />
        <et-hint>
          <ul class="m-0 flex list-disc flex-col gap-1 pl-5">
            <li>Max 12 chars</li>
            <li>Uppercased letter</li>
            <li>Special char</li>
            <li>No whitespace</li>
          </ul>
        </et-hint>
      </et-form-field>

      <p class="text-xs text-et-surface-muted">
        Blur the field to swap the large hint to real validation errors. Try values that are too long, missing
        uppercase, missing special chars, or containing whitespace.
      </p>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, FormField],
})
export class FormFieldUsernameHintStorybookComponent {
  private formModel = signal({
    username: '',
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.username, { message: 'Username is required' });
    maxLength(s.username, 12, { message: 'Max 12 chars' });
    pattern(s.username, /[A-Z]/, { message: 'Uppercased letter' });
    pattern(s.username, /[^\w\s]/, { message: 'Special char' });
    pattern(s.username, /^\S*$/, { message: 'No whitespace' });
  });

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-form-field-checkbox',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-checkbox [formField]="demoForm.acceptTerms" />
        <et-label>I accept the terms and conditions</et-label>
      </et-form-field>

      <et-form-field>
        <et-checkbox [formField]="demoForm.newsletter" />
        <et-label>Subscribe to newsletter</et-label>
      </et-form-field>

      <p class="text-xs text-et-surface-muted">"Accept terms" is required. Click away from it to trigger validation.</p>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField],
})
export class FormFieldCheckboxStorybookComponent {
  private formModel = signal({
    acceptTerms: false,
    newsletter: false,
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.acceptTerms, { message: 'You must accept the terms' });
  });

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-form-field-combined',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>Email address</et-label>
        <et-input [formField]="demoForm.email" type="email" placeholder="you@example.com" />
      </et-form-field>

      <et-form-field>
        <et-label>Password</et-label>
        <et-input [formField]="demoForm.password" type="password" placeholder="Enter password" />
      </et-form-field>

      <et-form-field>
        <et-checkbox [formField]="demoForm.rememberMe" />
        <et-label>Remember me</et-label>
      </et-form-field>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, ...CHECKBOX_IMPORTS, FormField],
})
export class FormFieldCombinedStorybookComponent {
  private formModel = signal({
    email: '',
    password: '',
    rememberMe: false,
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.email, { message: 'Email is required' });
    email(s.email, { message: 'Enter a valid email address' });
    required(s.password, { message: 'Password is required' });
  });

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-input-with-prefix-suffix',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>Search</et-label>
        <span class="opacity-50" etInputPrefix>🔍</span>
        <et-input [formField]="demoForm.search" type="search" placeholder="Search..." />
        <button class="cursor-pointer border-none bg-transparent opacity-50" etInputSuffix type="button">✕</button>
      </et-form-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, InputPrefixDirective, InputSuffixDirective, FormField],
})
export class InputWithPrefixSuffixStorybookComponent {
  private formModel = signal({ search: '' });

  public demoForm = form(this.formModel);

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-input-label-modes',
  template: `
    <div class="flex max-w-5xl flex-col gap-6 p-8 font-sans" etProvideSurface="dark">
      <div class="flex flex-col gap-2">
        <h3 class="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-et-surface">Label Modes</h3>
        <p class="m-0 text-sm text-et-surface-muted">
          Empty fields keep the label in the value line until focus or value.
        </p>
      </div>

      <div class="grid items-end gap-5 md:grid-cols-4 ">
        @for (example of LABEL_MODE_EXAMPLES; track example.mode) {
          @let exampleField = demoForm[example.mode];

          @if (exampleField) {
            <et-form-field [labelMode]="example.mode" fill="filled">
              <et-label>{{ example.label }}</et-label>
              <et-input [formField]="exampleField" [placeholder]="example.placeholder" />
            </et-form-field>
          }
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...INPUT_IMPORTS, FormField, ProvideSurfaceDirective],
})
export class InputLabelModesStorybookComponent {
  private formModel = signal<Record<FormFieldLabelMode, string>>({
    [FORM_FIELD_LABEL_MODES.STATIC]: '',
    [FORM_FIELD_LABEL_MODES.INLINE]: '',
    [FORM_FIELD_LABEL_MODES.FLOATING_INSIDE]: '',
    [FORM_FIELD_LABEL_MODES.FLOATING_OUTSIDE]: '',
  });

  protected readonly LABEL_MODE_EXAMPLES = LABEL_MODE_EXAMPLES;

  public demoForm = form(this.formModel);
}

@Component({
  selector: 'et-sb-input-variants-showcase',
  template: `
    <div [etProvideSurface]="theme()" [etProvideColor]="color()" class="flex max-w-8xl flex-col gap-8 p-8 font-sans">
      @for (section of SHOWCASE_SECTIONS; track section.label) {
        <section class="flex flex-col gap-5">
          <header class="flex items-center gap-3 border-b border-et-surface-border pb-3">
            <h3 class="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-et-surface">{{ section.label }}</h3>
            <span class="text-xs text-et-surface-muted">Grouped by size and affix state</span>
          </header>

          @for (size of section.sizes; track size.value) {
            <div class="flex flex-col gap-3">
              <h4 class="m-0 text-xs font-medium uppercase tracking-[0.16em] text-et-surface-muted">
                {{ size.label }}
              </h4>

              <div class="grid items-start gap-4 md:grid-cols-3">
                @for (example of size.examples; track example.key) {
                  <et-form-field
                    [appearance]="section.appearance"
                    [fill]="section.fill"
                    [size]="size.value"
                    [labelMode]="section.labelMode"
                  >
                    <et-label>{{ example.label }}</et-label>
                    @let exampleField = demoForm[example.key];

                    @if (example.affix === 'prefix') {
                      <span etInputPrefix>@</span>
                    }

                    @if (exampleField) {
                      <et-input [formField]="exampleField" [placeholder]="example.placeholder" />
                    }

                    @if (example.affix === 'suffix') {
                      <span etInputSuffix>.com</span>
                    }
                  </et-form-field>
                }
              </div>
            </div>
          }
        </section>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    InputPrefixDirective,
    InputSuffixDirective,
    FormField,
    ProvideSurfaceDirective,
    ProvideColorDirective,
  ],
})
export class InputVariantsShowcaseStorybookComponent {
  public theme = input<string>('dark');
  public color = input<string>('brand');
  public disabled = input<boolean>(false);
  public value = input<string>('');

  private formModel = signal(SHOWCASE_FORM_MODEL);

  protected readonly SHOWCASE_SECTIONS = SHOWCASE_SECTIONS;

  public demoForm = form(this.formModel, (root) => {
    disabled(root, () => this.disabled());
  });

  constructor() {
    effect(() => {
      const val = this.value();
      const model: Record<string, string> = {};

      for (const key of Object.keys(SHOWCASE_FORM_MODEL)) {
        model[key] = val;
      }

      this.formModel.set(model);
    });
  }
}
