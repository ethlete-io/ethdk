import { provideAnimations } from '@angular/platform-browser/animations';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { TableStorybookComponent } from './components';
import CustomMDXDocumentation from './table.docs.mdx';

export default {
  title: 'CDK/Table',
  component: TableStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [provideAnimations()],
    }),
  ],
  argTypes: {
    dataSource: {
      control: {
        type: 'object',
      },
    },
  },
  args: {
    dataSource: [
      { name: 'Hydrogen', weight: 1.0079, symbol: 'H', firstLetter: 'H' },
      { name: 'Helium', weight: 4.0026, symbol: 'He', firstLetter: 'H' },
      { name: 'Lithium', weight: 6.941, symbol: 'Li', firstLetter: 'L' },
      { name: 'Beryllium', weight: 9.0122, symbol: 'Be', firstLetter: 'B' },
      { name: 'Boron', weight: 10.811, symbol: 'B', firstLetter: 'B' },
      { name: 'Carbon', weight: 12.0107, symbol: 'C', firstLetter: 'C' },
      { name: 'Nitrogen', weight: 14.0067, symbol: 'N', firstLetter: 'N' },
    ],
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<TableStorybookComponent>;

const Template: StoryFn<TableStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
