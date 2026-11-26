import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  NavRouteFourComponent,
  NavRouteOneComponent,
  NavRouteThreeComponent,
  NavRouteTwoComponent,
  NavTabsLayoutShiftStorybookComponent,
  NavTabsStorybookComponent,
} from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Navigation/Tabs/Nav Tabs',
  component: NavTabsStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [NavTabsStorybookComponent, NavTabsLayoutShiftStorybookComponent] }),
    applicationConfig({
      providers: [
        provideRouter(
          [
            { path: 'one', component: NavRouteOneComponent },
            { path: 'two', component: NavRouteTwoComponent },
            { path: 'three', component: NavRouteThreeComponent },
            { path: 'four', component: NavRouteFourComponent },
            { path: '**', redirectTo: 'one' },
          ],
          withHashLocation(),
        ),
      ],
    }),
  ],
  args: {
    orientation: 'horizontal',
    variant: 'secondary',
    fit: 'content',
    align: 'start',
    tokens: null,
    divider: true,
    activeUnderline: true,
    underlineWidth: 'tab',
    disabled: false,
    color: 'brand',
  },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    variant: { control: 'radio', options: ['primary', 'secondary'] },
    fit: { control: 'radio', options: ['content', 'fill'] },
    align: { control: 'radio', options: ['start', 'center', 'end'] },
    tokens: { control: 'object' },
    divider: { control: 'boolean' },
    activeUnderline: { control: 'boolean' },
    underlineWidth: { control: 'radio', options: ['tab', 'label'] },
    disabled: { control: 'boolean' },
    color: { control: 'select', options: COLOR_OPTIONS },
  },
} as Meta<NavTabsStorybookComponent>;

type Story = StoryObj<NavTabsStorybookComponent>;

export const Default: Story = {};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};

export const WithDisabledLinks: Story = {
  args: {
    disabled: true,
  },
};

export const Centered: Story = {
  args: {
    align: 'center',
  },
};

export const RestyledWithTokens: Story = {
  args: {
    tokens: {
      '--et-tab-font-weight': '700',
      '--et-tab-text-transform': 'uppercase',
      '--et-tab-letter-spacing': '0.12em',
      '--et-tab-line-height': '1',
      '--et-tab-underline-size': '4px',
      '--et-tab-baseline-size': '1px',
      '--et-tab-hover-color': 'var(--et-surface-text)',
      '--et-tab-hover-underline-opacity': '1',
    },
  },
};

export const ThickUnderlineThinBaseline: Story = {
  args: {
    tokens: {
      '--et-tab-underline-size': '2px',
      '--et-tab-baseline-size': '1px',
      '--et-tab-baseline-opacity': '1',
      '--et-tab-baseline-color': 'var(--et-surface-text)',
    },
  },
};

export const LabelWidthUnderline: Story = {
  args: {
    underlineWidth: 'label',
  },
};

export const ColoredLabelsWithoutUnderline: Story = {
  args: {
    activeUnderline: false,
    tokens: {
      '--et-tab-active-color': 'var(--et-tone-fill)',
      '--et-tab-inactive-color': '#fff',
    },
  },
};

export const LayoutShift: StoryObj<NavTabsLayoutShiftStorybookComponent> = {
  args: { shift: 'font-swap', shiftDelay: 400 },
  argTypes: {
    shift: { control: 'radio', options: ['font-swap', 'late-icon', 'hidden-first-frame'] },
    shiftDelay: { control: 'number' },
  },
  render: (args) => ({
    props: args,
    template: `<et-sb-nav-tabs-layout-shift [shift]="shift" [shiftDelay]="shiftDelay" />`,
  }),
};
