import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TableStorybookComponent } from './components';

export default {
  title: 'Components/Table',
  component: TableStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [BrowserAnimationsModule],
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
      { name: 'Hydrogen', weight: 1.0079, symbol: 'H' },
      { name: 'Helium', weight: 4.0026, symbol: 'He' },
      { name: 'Lithium', weight: 6.941, symbol: 'Li' },
      { name: 'Beryllium', weight: 9.0122, symbol: 'Be' },
      { name: 'Boron', weight: 10.811, symbol: 'B' },
      { name: 'Carbon', weight: 12.0107, symbol: 'C' },
      { name: 'Nitrogen', weight: 14.0067, symbol: 'N' },
    ],
  },
} as Meta<TableStorybookComponent>;

const Template: Story<TableStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
