import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TabLinkDirective, TabNavBarComponent } from '../../../partials';
import { TabNavPanelComponent } from '../tab-nav-panel.component';

@Component({
  selector: 'et-tab-nav-panel-storybook',
  template: `
    <nav [tabPanel]="tabPanel" et-tab-nav-bar>
      <a et-tab-link routerLink="./one"> Tab One</a>
      <a et-tab-link routerLink="./two"> Other Tab</a>
      <a et-tab-link routerLink="./three"> One more Tab</a>
      <a et-tab-link routerLink="./four">Tab</a>
      <a et-tab-link disabled>Disabled Tab</a>
    </nav>

    <et-tab-nav-panel #tabPanel>
      <router-outlet></router-outlet>
    </et-tab-nav-panel>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  styles: [
    `
      .et-scrollable-container {
        gap: 25px;
      }
    `,
  ],
  imports: [TabNavBarComponent, TabNavPanelComponent, TabLinkDirective, RouterModule],
})
export class TabNavPanelStorybookComponent implements OnInit {
  constructor(private _router: Router) {}

  ngOnInit(): void {
    this._router.navigate(['./one']);
  }
}
