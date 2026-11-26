import { Component, ViewEncapsulation, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet, Routes } from '@angular/router';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS, provideBreadcrumbManager } from '@ethlete/components';
import { injectPathParam } from '@ethlete/core';
import { map, timer } from 'rxjs';

@Component({
  selector: 'app-home-view',
  template: `<h2>Home</h2>`,
  encapsulation: ViewEncapsulation.None,
})
export class HomeViewComponent {}

@Component({
  selector: 'app-teams-view',
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem routerLink="/teams">Teams</a>
      </ng-template>
    </ng-template>

    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, RouterLink, RouterOutlet],
})
export class TeamsViewComponent {}

@Component({
  selector: 'app-teams-list-view',
  template: `<h2>Teams</h2>`,
  encapsulation: ViewEncapsulation.None,
})
export class TeamsListViewComponent {}

@Component({
  selector: 'app-team-view',
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template [loading]="isLoadingName()" etBreadcrumbItemTemplate>
        <a [routerLink]="['/teams', teamId()]" etBreadcrumbItem>{{ name() }}</a>
      </ng-template>
    </ng-template>

    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, RouterLink, RouterOutlet],
})
export class TeamViewComponent {
  protected teamId = injectPathParam('teamId');
  protected name = toSignal(timer(1200).pipe(map(() => 'BSG Chemie Leipzig')), { initialValue: '…' });
  protected isLoadingName = computed(() => this.name() === '…');
}

@Component({
  selector: 'app-team-overview-view',
  template: `<h2>Team</h2>`,
  encapsulation: ViewEncapsulation.None,
})
export class TeamOverviewViewComponent {}

@Component({
  selector: 'app-team-squad-view',
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>Squad</span>
      </ng-template>
    </ng-template>

    <h2>Squad</h2>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS],
})
export class TeamSquadViewComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeViewComponent },
  {
    path: 'teams',
    component: TeamsViewComponent,
    children: [
      { path: '', component: TeamsListViewComponent },
      {
        path: ':teamId',
        component: TeamViewComponent,
        children: [
          { path: '', component: TeamOverviewViewComponent },
          { path: 'squad', component: TeamSquadViewComponent },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-breadcrumb-routed-outlet-example',
  template: `
    <nav class="example-nav">
      <a routerLink="/">Home</a>
      <a routerLink="/teams">Teams</a>
      <a routerLink="/teams/chemie">Team</a>
      <a routerLink="/teams/chemie/squad">Squad</a>
    </nav>

    <et-breadcrumb-outlet etBreadcrumbCollapse />

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem routerLink="/">Home</a>
      </ng-template>
    </ng-template>

    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS, RouterLink, RouterOutlet],
  providers: [provideBreadcrumbManager()],
  styles: `
    .example-nav {
      display: flex;
      gap: 16px;
    }
  `,
})
export class BreadcrumbRoutedOutletExampleComponent {}
