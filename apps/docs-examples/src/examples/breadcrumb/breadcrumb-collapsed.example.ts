import { Component, ViewEncapsulation } from '@angular/core';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-breadcrumb-collapsed-example',
  template: `
    <div class="example-narrow">
      <et-breadcrumb etBreadcrumbCollapse>
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
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS],
  styles: `
    .example-narrow {
      max-inline-size: 340px;
    }
  `,
})
export class BreadcrumbCollapsedExampleComponent {}
