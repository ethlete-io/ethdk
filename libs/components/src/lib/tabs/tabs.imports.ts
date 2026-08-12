import { NavTabLinkComponent } from './nav-tabs/nav-tab-link.component';
import { NavTabsOutletComponent } from './nav-tabs/nav-tabs-outlet.component';
import { NavTabsComponent } from './nav-tabs/nav-tabs.component';
import { OverlayNavTabLinkComponent } from './nav-tabs/overlay-nav-tab-link.component';
import { TabGroupComponent } from './tabs/tab-group.component';
import { TabLabelDirective } from './tabs/tab-label.directive';
import { TabComponent } from './tabs/tab.component';

export const NAV_TAB_IMPORTS = [
  NavTabsComponent,
  NavTabLinkComponent,
  NavTabsOutletComponent,
  OverlayNavTabLinkComponent,
] as const;

export const TAB_IMPORTS = [TabGroupComponent, TabComponent, TabLabelDirective] as const;
