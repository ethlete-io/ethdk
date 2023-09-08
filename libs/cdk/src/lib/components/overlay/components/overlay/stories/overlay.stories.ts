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
    id: {
      control: {
        type: 'text',
      },
    },
    customAnimated: {
      control: {
        type: 'boolean',
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
