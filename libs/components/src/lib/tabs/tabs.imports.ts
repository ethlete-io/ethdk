import { NavTabLinkComponent } from './nav-tabs/nav-tab-link.component';
import { NavTabsOutletComponent } from './nav-tabs/nav-tabs-outlet.component';
import { NavTabsComponent } from './nav-tabs/nav-tabs.component';
import { TabGroupComponent } from './tabs/tab-group.component';
import { TabLabelDirective } from './tabs/tab-label.directive';
import { TabComponent } from './tabs/tab.component';

export const NavTabImports = [NavTabsComponent, NavTabLinkComponent, NavTabsOutletComponent] as const;

export const TabImports = [TabGroupComponent, TabComponent, TabLabelDirective] as const;
