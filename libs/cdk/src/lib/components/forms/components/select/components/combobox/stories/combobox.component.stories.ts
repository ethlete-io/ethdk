/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import CustomMDXDocumentation from './combobox.docs.mdx';
import { StorybookComboboxComponent } from './components';

export default {
  title: 'CDK/Forms/Select/Combobox',
  component: StorybookComboboxComponent,
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
} as Meta<StorybookComboboxComponent>;

const Template: Story<StorybookComboboxComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
