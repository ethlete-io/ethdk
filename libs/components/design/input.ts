import description from '../src/lib/forms/description/description.component.css?inline';
import { CHECK_ICON } from '../src/lib/icon/headless/check-icon';
import { LOCK_ICON } from '../src/lib/icon/headless/lock-icon';
import { formField, formFieldStyles, FormFieldMockOptions, input, InputMockOptions } from './form-field';
import { iconMarkup } from './icon';

/** An interaction a frame forces with the `data-et-force` design marker. */
export type TextInputMockForce = 'hover' | 'focus-visible';

/** The icons the input stories put in the affixes. */
export const textInputAffixIcons = { lock: LOCK_ICON, check: CHECK_ICON };

export type TextInputMockOptions = Omit<FormFieldMockOptions, 'control'> &
  InputMockOptions & {
    /** An unresolved bulk-edit value: the raw value stays hidden and `mixedLabel` shows as the placeholder. */
    mixed?: boolean;
    mixedLabel?: string;
    /** An `et-description` under the field, as HTML. */
    description?: string;
    prefixIcon?: keyof typeof textInputAffixIcons;
    suffixIcon?: keyof typeof textInputAffixIcons;
    /** Forced interactions: `hover` on the control frame, `focus-visible` on the native input. */
    force?: TextInputMockForce | TextInputMockForce[];
  };

/** The stylesheets `textInput()` draws with: the real `et-form-field`, `et-input` and `et-description` CSS. */
export const textInputStyles = /* @__PURE__ */ [formFieldStyles, description].join('\n');

const forceList = (force: TextInputMockForce | TextInputMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

/** Draws `<et-form-field>` around `<et-input>` as HTML, with the DOM the components render. */
export const textInput = (options: TextInputMockOptions = {}) => {
  const { id = 'field', value, placeholder, type, textAlign, mixed, mixedLabel = 'Mixed', force, ...field } = options;
  const forced = forceList(force);
  const descriptionId = `et-description-${id}`;
  const control = input({
    value: mixed ? undefined : value,
    placeholder: mixed ? mixedLabel : placeholder,
    type,
    textAlign,
  });
  const prefix = options.prefixIcon ? iconMarkup(textInputAffixIcons[options.prefixIcon]) : options.prefix;
  const suffix = options.suffixIcon ? iconMarkup(textInputAffixIcons[options.suffixIcon]) : options.suffix;
  const prefixOffset = options.prefixIcon
    ? '--_et-form-field-prefix-offset: calc(16px + var(--et-form-field-control-affix-gap));'
    : undefined;

  let html = formField({
    ...field,
    id,
    prefix,
    suffix,
    style: [prefixOffset, options.style].filter(Boolean).join(' ') || undefined,
    control: {
      ...control,
      hasValue: !!mixed || control.hasValue,
      html: (state) => {
        const describedBy = [options.description !== undefined && descriptionId, state.describedBy]
          .filter(Boolean)
          .join(' ');
        let markup = control.html({ ...state, describedBy: describedBy || null });

        if (mixed) markup = markup.replace('<et-input class="et-color-interactive et-input"', '$& data-mixed="true"');
        if (forced.includes('focus-visible'))
          markup = markup.replace('<input ', '<input data-et-force="focus-visible" ');

        return markup;
      },
    },
  });

  if (forced.includes('hover')) {
    html = html.replace('<div class="et-form-field-control-frame"', '$& data-et-force="hover"');
  }

  if (options.description !== undefined) {
    const descriptionHtml = `<et-description class="et-description" id="${descriptionId}">${options.description}</et-description>`;
    const supportStart = html.indexOf('<div class="et-color-interactive-exclude et-form-field-support"');
    const at = supportStart === -1 ? html.lastIndexOf('</et-form-field>') : supportStart;

    html = `${html.slice(0, at)}${descriptionHtml}${html.slice(at)}`;
  }

  return html;
};
