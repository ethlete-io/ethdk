import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldCounterStorybookComponent } from './counter-storybook.component';

export default {
  title: 'Components/Forms/Form field/Counter',
  component: FormFieldCounterStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldCounterStorybookComponent] })],
  argTypes: {
    bio: { control: 'text' },
    hint: { control: 'text' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    bio: '',
    hint: '',
    color: 'brand',
  },
} as Meta<FormFieldCounterStorybookComponent>;

type Story = StoryObj<FormFieldCounterStorybookComponent>;

export const Default: Story = {};

/** The counter and the hint coexist — the counter sits at the inline-end and never swaps out. */
export const WithHint: Story = {
  args: { hint: 'A short introduction shown on your profile.' },
};

/**
 * Past the schema's limit: the counter turns to the error color while the validation message shows
 * underneath it, so the reader sees both the rule and the number that broke it.
 */
export const OverLimit: Story = {
  args: {
    bio: `Signal forms binds the schema's maxLength() straight into the control, so the counter picks the limit up without the consumer repeating it. This sentence exists purely to push the bio field past its one-hundred-and-eighty character limit so the over-limit styling is visible on load.`,
  },
};
