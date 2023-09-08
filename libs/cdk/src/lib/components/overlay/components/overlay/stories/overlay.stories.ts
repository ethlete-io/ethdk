import { Meta, Story } from '@storybook/angular';
import { createOverlayConfig } from '../utils';
import { OverlayHostStorybookComponent } from './components';
import CustomMDXDocumentation from './overlay.docs.mdx';

const defaultConfig = createOverlayConfig();

export default {
  title: 'CDK/Overlay/Overlay',
  component: OverlayHostStorybookComponent,
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
} as Meta<OverlayHostStorybookComponent>;

const Template: Story<OverlayHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
