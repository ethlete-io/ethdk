/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookRadioComponent } from './components';
import CustomMDXDocumentation from './radio.docs.mdx';

export default {
  title: 'CDK/Forms/Radio',
  component: StorybookRadioComponent,
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
} as Meta<StorybookRadioComponent>;

const Template: Story<StorybookRadioComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
