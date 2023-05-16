/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSlideToggleComponent } from './components';
import CustomMDXDocumentation from './slide-toggle.docs.mdx';

export default {
  title: 'CDK/Forms/Slide toggle',
  component: StorybookSlideToggleComponent,
  decorators: [
    applicationConfig({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookSlideToggleComponent>;

const Template: Story<StorybookSlideToggleComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
