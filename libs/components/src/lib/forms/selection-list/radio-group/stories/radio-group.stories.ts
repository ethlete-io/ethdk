import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { RadioGroupStorybookComponent } from './radio-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Radio Group',
  component: RadioGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [RadioGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'select', options: [null, 'red', 'green', 'blue'] },
    mixed: { control: 'boolean' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    variant: { control: 'radio', options: ['plain', 'card'] },
    controlPosition: { control: 'inline-radio', options: ['start', 'end'] },
    options: { control: false, table: { disable: true } },
  },
  args: {
    label: 'Favorite color',
    hint: '',
    value: null,
    mixed: false,
    showMixedState: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
    size: 'md',
    orientation: 'vertical',
    variant: 'plain',
    controlPosition: 'end',
  },
} as Meta<RadioGroupStorybookComponent>;

type Story = StoryObj<RadioGroupStorybookComponent>;

export const Default: Story = {};

export const Mixed: Story = {
  args: {
    value: 'green',
    mixed: true,
    showMixedState: true,
    hint: 'Bulk edit over records that disagree - no radio reads as checked until a user picks one, which replaces the hidden raw value.',
  },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const Card: Story = {
  args: { variant: 'card', label: 'Pick a colour' },
  parameters: {
    docs: {
      description: {
        story:
          'The card preset: the whole panel is the target, label leading and control trailing, with room for an ' +
          '`<et-description>` under each label. For a short list of consequential choices - a plan, a shipping ' +
          'speed - where a 20px circle is a small thing to aim at.',
      },
    },
  },
};

export const CardSlots: Story = {
  args: {
    variant: 'card',
    label: 'Plan',
    value: 'team',
    options: [
      {
        value: 'solo',
        label: 'Solo',
        description: 'One seat, everything you need to ship.',
        icon: 'et-star',
        price: '$9',
      },
      {
        value: 'team',
        label: 'Team',
        description: 'Everything in Solo, plus shared workspaces.',
        icon: 'et-circle-check',
        price: '$29',
      },
      {
        value: 'business',
        label: 'Business',
        description: 'SSO, audit logs and a support SLA.',
        icon: 'et-trophy',
        price: '$99',
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          '`[etSelectionCardLeading]` and `[etSelectionCardTrailing]` project into the ends of the card - the plan ' +
          'icon and the price a "choose your plan" row is made of. Switch `controlPosition` to `\'start\'` to put ' +
          'the control ahead of the leading icon.',
      },
    },
  },
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal', label: 'Size' },
  parameters: {
    docs: {
      description: {
        story:
          '`orientation="horizontal"` flows the radios in a wrapping row, with the label and the ' +
          'error/hint block keeping their own lines. Best kept for a small set of short options - vertical ' +
          'scans better and gives each option a full-width hit area. All four arrow keys move between ' +
          'options either way, which is what the ARIA radio pattern expects.',
      },
    },
  },
};
