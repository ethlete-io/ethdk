import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  NavRouteFourComponent,
  NavRouteOneComponent,
  NavRouteThreeComponent,
  NavRouteTwoComponent,
  NavTabsStorybookComponent,
} from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Tabs/Nav Tabs',
  component: NavTabsStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [NavTabsStorybookComponent] }),
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
    divider: true,
    disabled: false,
    color: 'brand',
  },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    variant: { control: 'radio', options: ['primary', 'secondary'] },
    fit: { control: 'radio', options: ['content', 'fill'] },
    divider: { control: 'boolean' },
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
