import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSelectionListComponent } from './components';
import CustomMDXDocumentation from './selection-list.docs.mdx';

export default {
  title: 'Experimental/CDK/Forms/Selection list',
  component: StorybookSelectionListComponent,
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
} as Meta<StorybookSelectionListComponent>;

const Template: Story<StorybookSelectionListComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
