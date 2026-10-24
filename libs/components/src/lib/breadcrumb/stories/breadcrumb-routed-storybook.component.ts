import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AutoSurfaceDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button/button.imports';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS } from '../breadcrumb.imports';

@Component({
  selector: 'et-sb-breadcrumb-routed',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <nav class="flex flex-wrap gap-2">
        <a et-button size="sm" variant="outline" routerLink="/">Home</a>
        <a et-button size="sm" variant="outline" routerLink="/teams">Teams</a>
        <a et-button size="sm" variant="outline" routerLink="/teams/chemie">Team</a>
        <a et-button size="sm" variant="outline" routerLink="/teams/chemie/squad">Squad</a>
      </nav>

      <et-breadcrumb-outlet etBreadcrumbCollapse />

      <ng-template etBreadcrumbSegment>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/">Home</a>
        </ng-template>
      </ng-template>

      <div
        class="flex min-h-40 flex-col gap-3 rounded-lg p-6"
        etAutoSurface
        style="background: var(--et-surface-background-solid)"
      >
        <router-outlet />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BREADCRUMB_IMPORTS,
    BREADCRUMB_COLLAPSE_IMPORTS,
    BUTTON_IMPORTS,
    AutoSurfaceDirective,
    ProvideSurfaceDirective,
    RouterLink,
    RouterOutlet,
  ],
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
  template: `<h2 class="text-h5 m-0">Teams</h2>
    <p class="m-0">All teams of the league.</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class BreadcrumbTeamsPageComponent {}

@Component({
  selector: 'et-sb-breadcrumb-page-home',
  template: `<h2 class="text-h5 m-0">Home</h2>
    <p class="m-0">Pick a section above and watch the breadcrumb grow.</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class BreadcrumbHomePageComponent {}

@Component({
  selector: 'et-sb-breadcrumb-page-team',
  template: `
    <h2 class="text-h5 m-0">Team</h2>
    <p class="m-0">The team crumb fills in once the name has loaded.</p>

    <ng-template etBreadcrumbSegment>
      <ng-template [loading]="isLoadingName()" etBreadcrumbItemTemplate>
        <a etBreadcrumbItem routerLink="/teams/chemie">{{ name() }}</a>
      </ng-template>
    </ng-template>

    <router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, RouterLink, RouterOutlet],
  host: { class: 'flex flex-col gap-3' },
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
    <h2 class="text-h5 m-0">Squad</h2>
    <p class="m-0">The current page is the last crumb.</p>

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>Squad</span>
      </ng-template>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS],
  host: { class: 'flex flex-col gap-3' },
})
export class BreadcrumbSquadPageComponent {}
