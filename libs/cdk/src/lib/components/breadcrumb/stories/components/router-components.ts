import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbImports } from '../../breadcrumb.imports';
import { BreadcrumbItemDirective } from '../../directives';

@Component({
  selector: 'et-router-component-one',
  template: ` <h1>One</h1> `,
})
export class RouterOneComponent {}

@Component({
  selector: 'et-router-component-two',
  template: `
    <h1>Two</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/one">Ebene 1</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Ebene 2</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
})
export class RouterTwoComponent {}

@Component({
  selector: 'et-router-component-three',
  template: `
    <h1>Three</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/one">Ebene 1</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/two">Ebene 2</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Ebene 3</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
})
export class RouterThreeComponent {}

@Component({
  selector: 'et-router-component-four',
  template: `
    <h1>Four</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/one">Ebene 1</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/two">Ebene 2</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/three">Ebene 3</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Ebene 4</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports],
})
export class RouterFourComponent {}

@Component({
  selector: 'et-router-component-five',
  template: `
    <h1>Five</h1>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/one">Ebene 1</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/two">Ebene 2</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/three">Ebene 3</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/four">Ebene 4</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Ebene 5</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  imports: [RouterLink, BreadcrumbImports, BreadcrumbItemDirective],
})
export class RouterFiveComponent {}
