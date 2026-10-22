import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS, provideBreadcrumbManager } from '@ethlete/components';
import { tap, timer } from 'rxjs';

@Component({
  selector: 'app-breadcrumb-squad-page',
  template: `
    <h2>Squad</h2>

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

@Component({
  selector: 'app-breadcrumb-team-page',
  template: `
    <h2>Team</h2>

    <ng-template etBreadcrumbSegment>
      <ng-template [loading]="isLoadingName()" etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#team">{{ name() }}</a>
      </ng-template>
    </ng-template>

    @if (depth() >= 3) {
      <app-breadcrumb-squad-page />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BreadcrumbSquadPageComponent],
})
export class BreadcrumbTeamPageComponent {
  public depth = input(2);

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
  selector: 'app-breadcrumb-teams-layout',
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#teams">Teams</a>
      </ng-template>
    </ng-template>

    @if (depth() >= 2) {
      <app-breadcrumb-team-page [depth]="depth()" />
    } @else {
      <h2>Teams</h2>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BreadcrumbTeamPageComponent],
})
export class BreadcrumbTeamsLayoutComponent {
  public depth = input(1);
}

@Component({
  selector: 'app-breadcrumb-routed-outlet-example',
  template: `
    <nav class="example-nav">
      <button (click)="depth.set(0)" type="button">Home</button>
      <button (click)="depth.set(1)" type="button">Teams</button>
      <button (click)="depth.set(2)" type="button">Team</button>
      <button (click)="depth.set(3)" type="button">Squad</button>
    </nav>

    <et-breadcrumb-outlet etBreadcrumbCollapse />

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#home">Home</a>
      </ng-template>
    </ng-template>

    @if (depth() >= 1) {
      <app-breadcrumb-teams-layout [depth]="depth()" />
    } @else {
      <h2>Home</h2>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS, BreadcrumbTeamsLayoutComponent],
  providers: [provideBreadcrumbManager()],
  styles: `
    .example-nav {
      display: flex;
      gap: 16px;
    }
  `,
})
export class BreadcrumbRoutedOutletExampleComponent {
  protected depth = signal(3);
}
