import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { BottomSheetHostStorybookComponent } from './components';
import CustomMDXDocumentation from './bottom-sheet.docs.mdx';
import { BottomSheetModule } from '../bottom-sheet.module';
import { BottomSheetConfig } from '../utils';

const defaultConfig = new BottomSheetConfig();

export default {
  title: 'Components/Overlay/Bottom sheet',
  component: BottomSheetHostStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [BottomSheetModule],
    }),
  ],
  argTypes: {
    disableClose: {
      control: {
        type: 'boolean',
      },
    },
    hasBackdrop: {
      control: {
        type: 'boolean',
      },
    },
    restoreFocus: {
      control: {
        type: 'boolean',
      },
    },
    ariaLabel: {
      control: {
        type: 'text',
      },
    },
    autoFocus: {
      control: {
        type: 'text',
      },
    },
    backdropClass: {
      control: {
        type: 'text',
      },
    },
    closeOnNavigation: {
      control: {
        type: 'boolean',
      },
    },
    data: {
      control: {
        type: 'object',
      },
    },
    direction: {
      control: {
        type: 'radio',
      },
      options: ['ltr', 'rtl'],
    },
    delayFocusTrap: {
      control: {
        type: 'boolean',
      },
    },
    enterAnimationDuration: {
      control: {
        type: 'number',
      },
    },
    exitAnimationDuration: {
      control: {
        type: 'number',
      },
    },
    id: {
      control: {
        type: 'text',
      },
    },
    panelClass: {
      control: {
        type: 'text',
      },
    },
  },
  args: defaultConfig,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<BottomSheetHostStorybookComponent>;

const Template: Story<BottomSheetHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
