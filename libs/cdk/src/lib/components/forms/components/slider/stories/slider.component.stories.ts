/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
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
  },
  args: {
    min: 0,
    max: 100,
    step: 1,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookSliderComponent>;

const Template: Story<StorybookSliderComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
