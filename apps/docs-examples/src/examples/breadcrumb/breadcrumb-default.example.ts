import { Component, ViewEncapsulation } from '@angular/core';
import { BREADCRUMB_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-breadcrumb-default-example',
  template: `
    <et-breadcrumb>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#home">Home</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#competitions">Competitions</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#rl-nordost">Regionalliga Nordost</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#matchday-14">Matchday 14</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>Chemie Leipzig vs. Lok</span>
      </ng-template>
    </et-breadcrumb>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS],
})
export class BreadcrumbDefaultExampleComponent {}
