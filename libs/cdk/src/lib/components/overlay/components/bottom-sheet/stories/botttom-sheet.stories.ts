import { Meta, StoryFn } from '@storybook/angular';
import { createBottomSheetConfig } from '../utils';
import CustomMDXDocumentation from './bottom-sheet.docs.mdx';
import { BottomSheetHostStorybookComponent } from './components';

const defaultConfig = createBottomSheetConfig();

export default {
  title: 'Deprecated/CDK/Overlay/Bottom sheet',
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
    overlayClass: {
      control: {
        type: 'text',
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

const Template: StoryFn<BottomSheetHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
