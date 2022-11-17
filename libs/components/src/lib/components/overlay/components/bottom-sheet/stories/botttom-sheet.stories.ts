import { Meta, Story } from '@storybook/angular';
import { BottomSheetConfig } from '../utils';
import CustomMDXDocumentation from './bottom-sheet.docs.mdx';
import { BottomSheetHostStorybookComponent } from './components';

const defaultConfig = new BottomSheetConfig();

export default {
  title: 'Components/Overlay/Bottom sheet',
  component: BottomSheetHostStorybookComponent,
  argTypes: {
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
    containerClass: {
      control: {
        type: 'text',
      },
    },
    customAnimated: {
      control: {
        type: 'boolean',
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
    delayFocusTrap: {
      control: {
        type: 'boolean',
      },
    },
    direction: {
      control: {
        type: 'radio',
      },
      options: ['ltr', 'rtl'],
    },
    disableClose: {
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
    hasBackdrop: {
      control: {
        type: 'boolean',
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
    restoreFocus: {
      control: {
        type: 'boolean',
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
