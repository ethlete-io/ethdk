import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterOutlet, Routes } from '@angular/router';
import { BreadcrumbImports, provideBreadcrumbManager } from '@ethlete/cdk';

@Component({
  selector: 'app-products-view',
  template: `
    <h2>Products</h2>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Products</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BreadcrumbImports],
})
export class ProductsViewComponent {}

@Component({
  selector: 'app-category-view',
  template: `
    <h2>Shoes</h2>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/products">Products</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Shoes</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BreadcrumbImports, RouterLink],
})
export class CategoryViewComponent {}

@Component({
  selector: 'app-product-view',
  template: `
    <h2>Trail runner</h2>

    <ng-template etBreadcrumbTemplate>
      <et-breadcrumb>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/products">Products</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/products/shoes">Shoes</a>
        </ng-template>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Trail runner</span>
        </ng-template>
      </et-breadcrumb>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BreadcrumbImports, RouterLink],
})
export class ProductViewComponent {}

export const routes: Routes = [
  { path: 'products', pathMatch: 'full', component: ProductsViewComponent },
  { path: 'products/shoes', component: CategoryViewComponent },
  { path: 'products/shoes/trail-runner', component: ProductViewComponent },
  { path: '**', redirectTo: 'products/shoes/trail-runner' },
];

@Component({
  selector: 'app-cdk-breadcrumb-default-example',
  template: `
    <et-breadcrumb-outlet />
    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BreadcrumbImports, RouterOutlet],
  providers: [provideBreadcrumbManager()],
})
export class CdkBreadcrumbDefaultExampleComponent {}
