import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonTextIconStorybookComponent, ButtonTextStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Text',
  component: ButtonTextStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonTextStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false },
} as Meta<ButtonTextStorybookComponent>;

type Story = StoryObj<ButtonTextStorybookComponent>;

export const Default: Story = {};

export const WithIcon: StoryObj<ButtonTextIconStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ButtonTextIconStorybookComponent] })],
  render: (args) => ({
    props: args,
    template: `
      <et-sb-button-text-icon
        [color]="color"
        [disabled]="disabled"
        [loading]="loading"
      />
    `,
  }),
};
