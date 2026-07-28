import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { tap, timer } from 'rxjs';
import { BREADCRUMB_IMPORTS } from '../breadcrumb.imports';

/**
 * The app shell: it renders the outlet without knowing what any view's trail says, and contributes the
 * root crumb itself.
 */
@Component({
  selector: 'et-sb-breadcrumb-routed',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <nav class="flex gap-4">
        <a class="underline" routerLink="/teams">Teams</a>
        <a class="underline" routerLink="/teams/chemie">Team</a>
        <a class="underline" routerLink="/teams/chemie/squad">Squad</a>
      </nav>

      <div class="rounded-lg border border-white/15 p-4">
        <et-breadcrumb-outlet />
      </div>

      <ng-template etBreadcrumbSegment>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem routerLink="/teams">Home</a>
        </ng-template>
      </ng-template>

      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, ProvideSurfaceDirective, RouterLink, RouterOutlet],
})
export class BreadcrumbRoutedStorybookComponent {
  public surface = input('dark');
}

/** A layout route: contributes its own crumb and hosts the child routes. Nothing else. */
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

/** A detail route: contributes exactly one crumb — the record's name, which only it can know. */
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
  // The crumb only this view can fill in: a placeholder holds its slot until the name is there.
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
