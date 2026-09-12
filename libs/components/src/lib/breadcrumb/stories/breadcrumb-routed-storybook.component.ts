import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { tap, timer } from 'rxjs';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS } from '../breadcrumb.imports';

@Component({
  selector: 'et-sb-breadcrumb-routed',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <nav class="flex gap-4">
        <a class="underline" routerLink="/">Home</a>
        <a class="underline" routerLink="/teams">Teams</a>
        <a class="underline" routerLink="/teams/chemie">Team</a>
        <a class="underline" routerLink="/teams/chemie/squad">Squad</a>
      </nav>

      <et-breadcrumb-outlet etBreadcrumbCollapse />

      <ng-template etBreadcrumbSegment>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/">Home</a>
        </ng-template>
      </ng-template>

      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS, ProvideSurfaceDirective, RouterLink, RouterOutlet],
})
export class BreadcrumbRoutedStorybookComponent {
  public surface = input('dark');
}

@Component({
  selector: 'et-sb-breadcrumb-teams-layout',
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
export class BreadcrumbTeamsLayoutComponent {}

@Component({
  selector: 'et-sb-breadcrumb-page-teams',
  template: `<h2 class="m-0">Teams</h2>`,
  encapsulation: ViewEncapsulation.None,
})
export class BreadcrumbTeamsPageComponent {}

@Component({
  selector: 'et-sb-breadcrumb-page-home',
  template: `<h2 class="m-0">Home</h2>`,
  encapsulation: ViewEncapsulation.None,
})
export class BreadcrumbHomePageComponent {}

@Component({
  selector: 'et-sb-breadcrumb-page-team',
  template: `
    <h2 class="m-0">Team</h2>

    <ng-template etBreadcrumbSegment>
      <ng-template [loading]="isLoadingName()" etBreadcrumbItemTemplate>
        <a etBreadcrumbItem routerLink="/teams/chemie">{{ name() }}</a>
      </ng-template>
    </ng-template>

    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, RouterLink, RouterOutlet],
})
export class BreadcrumbTeamPageComponent {
  protected isLoadingName = signal(true);
  protected name = signal('…');

  constructor() {
    timer(1200)
      .pipe(
        tap(() => {
          this.name.set('BSG Chemie Leipzig');
          this.isLoadingName.set(false);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}

@Component({
  selector: 'et-sb-breadcrumb-page-squad',
  template: `
    <h2 class="m-0">Squad</h2>

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>Squad</span>
      </ng-template>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS],
})
export class BreadcrumbSquadPageComponent {}
