import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSliderComponent } from './components';
import CustomMDXDocumentation from './slider.docs.mdx';

export default {
  title: 'CDK/Forms/Slider',
  component: StorybookSliderComponent,
  decorators: [
    applicationConfig({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  argTypes: {
    min: { control: { type: 'number' } },
    max: { control: { type: 'number' } },
    step: { control: { type: 'number' } },
    renderValueTooltip: { control: { type: 'boolean' } },
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
    renderValueTooltip: false,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookSliderComponent>;

const Template: StoryFn<StorybookSliderComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
