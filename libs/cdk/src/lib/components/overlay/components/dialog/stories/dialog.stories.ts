import { Meta, StoryFn } from '@storybook/angular';
import { createDialogConfig } from '../utils';
import { DialogHostStorybookComponent } from './components';
import CustomMDXDocumentation from './dialog.docs.mdx';

const defaultConfig = createDialogConfig();

export default {
  title: 'Deprecated/CDK/Overlay/Dialog',
  component: DialogHostStorybookComponent,
  argTypes: {
    ariaDescribedBy: {
      control: {
        type: 'text',
      },
    },
    ariaLabel: {
      control: {
        type: 'text',
      },
    },
    ariaLabelledBy: {
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
    overlayClass: {
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
    hasBackdrop: {
      control: {
        type: 'boolean',
      },
    },
    height: {
      control: {
        type: 'text',
      },
    },
    id: {
      control: {
        type: 'text',
      },
    },
    maxHeight: {
      control: {
        type: 'text',
      },
    },
    maxWidth: {
      control: {
        type: 'text',
      },
    },
    minHeight: {
      control: {
        type: 'text',
      },
    },
    minWidth: {
      control: {
        type: 'text',
      },
    },
    panelClass: {
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
    position: {
      control: {
        type: 'object',
      },
    },
    restoreFocus: {
      control: {
        type: 'boolean',
      },
    },
    role: {
      control: {
        type: 'radio',
      },
      options: ['dialog', 'alertdialog'],
    },
    width: {
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
} as Meta<DialogHostStorybookComponent>;

const Template: StoryFn<DialogHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
