/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSliderComponent } from './components';
import CustomMDXDocumentation from './slider.docs.mdx';

export default {
  title: 'Components/Forms/Slider',
  component: StorybookSliderComponent,
  decorators: [
    moduleMetadata({
      providers: [provideValidatorErrorsService()],
    }),
  ],
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
