import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbImports } from '../../breadcrumb.imports';

@Component({
  selector: 'et-router-component-one',
  template: ` <h1>One</h1> `,
  standalone: true,
})
export class RouterOneComponent {}

@Component({
  selector: 'et-router-component-two',
  template: `
    <h1>Two</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <a *etBreadcrumbItemTemplate routerLink="/one" etBreadcrumbItem>Ebene 1</a>
        <span *etBreadcrumbItemTemplate etBreadcrumbItem>Ebene 2</span>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
  standalone: true,
})
export class RouterTwoComponent {}

@Component({
  selector: 'et-router-component-three',
  template: `
    <h1>Three</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <a *etBreadcrumbItemTemplate routerLink="/one" etBreadcrumbItem>Ebene 1</a>
        <a *etBreadcrumbItemTemplate routerLink="/two" etBreadcrumbItem>Ebene 2</a>
        <span *etBreadcrumbItemTemplate etBreadcrumbItem>Ebene 3</span>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
  standalone: true,
})
export class RouterThreeComponent {}

@Component({
  selector: 'et-router-component-four',
  template: `
    <h1>Four</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <a *etBreadcrumbItemTemplate routerLink="/one" etBreadcrumbItem>Ebene 1</a>
        <a *etBreadcrumbItemTemplate routerLink="/two" etBreadcrumbItem>Ebene 2</a>
        <a *etBreadcrumbItemTemplate routerLink="/three" etBreadcrumbItem>Ebene 3</a>
        <span *etBreadcrumbItemTemplate etBreadcrumbItem>Ebene 4</span>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
  standalone: true,
})
export class RouterFourComponent {}

@Component({
  selector: 'et-router-component-five',
  template: `
    <h1>Five</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <a *etBreadcrumbItemTemplate routerLink="/one" etBreadcrumbItem>Ebene 1</a>
        <a *etBreadcrumbItemTemplate routerLink="/two" etBreadcrumbItem>Ebene 2</a>
        <a *etBreadcrumbItemTemplate routerLink="/three" etBreadcrumbItem>Ebene 3</a>
        <a *etBreadcrumbItemTemplate routerLink="/four" etBreadcrumbItem>Ebene 4</a>
        <span *etBreadcrumbItemTemplate etBreadcrumbItem>Ebene 5</span>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
  standalone: true,
})
export class RouterFiveComponent {}
