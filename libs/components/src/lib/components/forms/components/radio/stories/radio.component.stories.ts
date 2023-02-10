/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookRadioComponent } from './components';
import CustomMDXDocumentation from './radio.docs.mdx';

export default {
  title: 'Components/Forms/Radio',
  component: StorybookRadioComponent,
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
} as Meta<StorybookRadioComponent>;

const Template: Story<StorybookRadioComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
