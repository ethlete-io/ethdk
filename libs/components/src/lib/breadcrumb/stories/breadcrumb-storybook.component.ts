import { Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BREADCRUMB_IMPORTS } from '../breadcrumb.imports';

@Component({
  selector: 'et-sb-breadcrumb',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <!-- The box is what the breadcrumb measures itself against: narrow it past the trail's natural
           width and the middle crumbs move into the overflow control. -->
      <div [style.max-inline-size.px]="width()">
        <et-breadcrumb [collapse]="collapse()">
          <ng-template etBreadcrumbItemTemplate>
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Home</a>
          </ng-template>
          <ng-template etBreadcrumbItemTemplate>
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Competitions</a>
          </ng-template>
          <ng-template etBreadcrumbItemTemplate>
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Regionalliga Nordost</a>
          </ng-template>
          <ng-template etBreadcrumbItemTemplate>
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Matchday 14</a>
          </ng-template>
          <ng-template [loading]="loading()" etBreadcrumbItemTemplate>
            <span etBreadcrumbItem>Chemie Leipzig vs. Lok</span>
          </ng-template>

          @if (separator() === 'slash') {
            <ng-template etBreadcrumbSeparator>/</ng-template>
          }
        </et-breadcrumb>
      </div>

      <p class="text-small">
        Drag the <code>width</code> control down: the trail collapses to first + overflow + last as soon as it stops
        fitting, and expands again once there is room for all of it.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, ProvideSurfaceDirective],
})
export class BreadcrumbStorybookComponent {
  public surface = input('dark');
  public width = input(640);
  public collapse = input(true);
  public loading = input(false);
  public separator = input<'chevron' | 'slash'>('chevron');

  // Real crumbs are `routerLink`s (see the routed story); these are hrefs only so they behave like links
  // without a route to go to, so the demo swallows the navigation.
  protected stayHere(event: Event) {
    event.preventDefault();
  }
}
