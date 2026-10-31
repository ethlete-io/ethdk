import description from '../src/lib/forms/description/description.component.css?inline';
import textareaField from '../src/lib/forms/form-field/form-field-textarea-styles.component.css?inline';
import { formField, formFieldStyles, FormFieldMockOptions, textarea, TextareaMockOptions } from './form-field';

/** An interaction a frame forces with the `data-et-force` design marker. */
export type TextareaFieldMockForce = 'hover' | 'focus-visible';

export type TextareaFieldMockOptions = Omit<FormFieldMockOptions, 'control'> &
  TextareaMockOptions & {
    /** Caps the autosize growth at this many rows; the textarea scrolls past it. */
    maxRows?: number;
    /** An unresolved bulk-edit value: the raw value stays hidden and `mixedLabel` shows as the placeholder. */
    mixed?: boolean;
    mixedLabel?: string;
    /** An `et-description` under the field, as HTML. */
    description?: string;
    /** Forced interactions: `hover` on the control frame, `focus-visible` on the native textarea. */
    force?: TextareaFieldMockForce | TextareaFieldMockForce[];
  };

/** The stylesheets `textareaField()` draws with: the real `et-form-field`, `et-textarea` and `et-description` CSS. */
export const textareaFieldStyles = /* @__PURE__ */ [formFieldStyles, textareaField, description].join('\n');

const forceList = (force: TextareaFieldMockForce | TextareaFieldMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

/** Draws `<et-form-field>` around `<et-textarea>` as HTML, with the DOM the components render. */
export const textareaField = (options: TextareaFieldMockOptions = {}) => {
  const {
    id = 'field',
    value,
    placeholder,
    rows,
    autosize = true,
    minRows,
    maxRows,
    mixed,
    mixedLabel = 'Mixed',
    force,
    ...field
  } = options;
  const forced = forceList(force);
  const descriptionId = `et-description-${id}`;
  const control = textarea({
    value: mixed ? undefined : value,
    placeholder: mixed ? mixedLabel : placeholder,
    rows,
    autosize,
    minRows,
  });

  let html = formField({
    ...field,
    id,
    control: {
      ...control,
      hasValue: !!mixed || control.hasValue,
      html: (state) => {
        const describedBy = [options.description !== undefined && descriptionId, state.describedBy]
          .filter(Boolean)
          .join(' ');
        let markup = control.html({ ...state, describedBy: describedBy || null });

        if (mixed)
          markup = markup.replace('<et-textarea class="et-color-interactive et-textarea"', '$& data-mixed="true"');
        if (autosize && maxRows !== undefined)
          markup = markup.replace(
            /(--et-textarea-min-rows: \d+)"/,
            `$1; --et-textarea-max-block-size: calc(${maxRows} * 1lh)"`,
          );
        if (forced.includes('focus-visible'))
          markup = markup.replace('<textarea ', '<textarea data-et-force="focus-visible" ');

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
