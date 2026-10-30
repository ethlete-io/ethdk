import { formField } from '@ethlete/components/design/form-field';
import { select, selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing } from '@design-system';

type Props = { value?: string; open?: boolean; active?: string };

const OPTIONS = [
  { value: 'drafts', label: 'Drafts' },
  { value: 'review', label: 'In review' },
  { value: 'merged', label: 'Merged' },
];

export default definePart<Props>({
  note: 'The SDK select inside a form field, drawn by its mock from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: {
    placeholder: {},
    selected: { value: 'review' },
    open: { value: 'review', open: true, active: 'merged' },
  },
  widths: [320],
  render: ({ value, open, active }) =>
    drawing({
      body: formField({
        id: 'status',
        label: 'Status',
        errorColor: 'danger',
        open,
        control: select({ options: OPTIONS, value, active, placeholder: 'Pick a status' }),
      }),
      styles: selectStyles,
    }),
});
