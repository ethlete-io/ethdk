import { formField, formFieldStyles, input } from '@ethlete/components/design/form-field';
import { definePart, drawing } from '@design-system';
import tokens from '@system/foundations/tokens.css?inline';

type Props = { value?: string; hint?: string; error?: string; focused?: boolean; disabled?: boolean };

export default definePart<Props>({
  note: 'The SDK form field with a text input, drawn by its mock from @ethlete/components/design.',
  states: {
    empty: { hint: 'Shown on your profile' },
    filled: { value: 'Ada Lovelace' },
    focused: { value: 'Ada', focused: true },
    error: { error: 'This field is required' },
    disabled: { value: 'Ada Lovelace', disabled: true },
  },
  widths: [320],
  render: ({ value, ...field }) =>
    drawing({
      body: formField({ id: 'name', label: 'Name', errorColor: 'danger', control: input({ value }), ...field }),
      styles: tokens + formFieldStyles,
    }),
});
