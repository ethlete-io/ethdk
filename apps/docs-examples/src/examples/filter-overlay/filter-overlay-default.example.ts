import { Component, computed, Signal, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import {
  BUTTON_IMPORTS,
  CHIP_IMPORTS,
  dialogOverlayStrategy,
  FILTER_OVERLAY_IMPORTS,
  FilterOverlayPreview,
  FLOATING_ACTION_IMPORTS,
  FORM_FIELD_IMPORTS,
  injectFilterOverlay,
  injectOverlayManager,
  INPUT_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayBackOrCloseDirective,
  OverlayMainDirective,
  OverlayHeaderTemplateDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  provideFilterOverlay,
  provideOverlayRouter,
  RADIO_GROUP_IMPORTS,
} from '@ethlete/components';
import { map, switchMap, tap, timer } from 'rxjs';
import {
  createTeamFilters,
  DIVISION_LABELS,
  DIVISIONS,
  matchTeams,
  REGION_LABELS,
  REGIONS,
  TEAMS,
  TeamFilterValue,
} from './filter-overlay.data';

@Component({
  selector: 'app-filter-overlay-main-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Filters</ng-template>

    <et-form-field>
      <et-label>Search</et-label>
      <et-input [formField]="filters.draft.fields.search" placeholder="Team name" />
      <et-hint>Matches the team name.</et-hint>
    </et-form-field>

    <button etOverlayRouterLink="/region" et-button variant="outline" size="sm">
      Region - {{ REGION_LABELS[filters.draft.value().region] }}
    </button>

    <button etOverlayRouterLink="/division" et-button variant="outline" size="sm">
      Division - {{ DIVISION_LABELS[filters.draft.value().division] }}
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    OverlayHeaderTemplateDirective,
    OverlayRouterLinkDirective,
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    FormField,
  ],
})
export class FilterOverlayMainPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly REGION_LABELS = REGION_LABELS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;
}

@Component({
  selector: 'app-filter-overlay-region-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Region</ng-template>

    <et-radio-group [formField]="filters.draft.fields.region">
      <et-label>Region</et-label>
      @for (region of REGIONS; track region) {
        <et-radio [value]="region">{{ REGION_LABELS[region] }}</et-radio>
      }
    </et-radio-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, RADIO_GROUP_IMPORTS, FORM_FIELD_IMPORTS, FormField],
})
export class FilterOverlayRegionPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly REGIONS = REGIONS;
  protected readonly REGION_LABELS = REGION_LABELS;
}

@Component({
  selector: 'app-filter-overlay-division-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Division</ng-template>

    <et-radio-group [formField]="filters.draft.fields.division">
      <et-label>Division</et-label>
      @for (division of DIVISIONS; track division) {
        <et-radio [value]="division">{{ DIVISION_LABELS[division] }}</et-radio>
      }
    </et-radio-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, RADIO_GROUP_IMPORTS, FORM_FIELD_IMPORTS, FormField],
})
export class FilterOverlayDivisionPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly DIVISIONS = DIVISIONS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;
}

@Component({
  selector: 'app-filter-overlay-shell',
  template: `
    <div etOverlayHeader>
      <button aria-label="Back" et-button etOverlayBackOrClose variant="transparent" size="sm">&larr;</button>
      <h2 etOverlayTitle>
        <et-overlay-route-header-template-outlet />
      </h2>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet />
    </et-overlay-body>

    <div etOverlayFooter>
      <button et-button etFilterOverlayReset variant="transparent" size="sm">
        {{ filters.labels().reset }}
      </button>

      <button #submit="etFilterOverlaySubmit" et-button etFilterOverlaySubmit size="sm">
        {{ submit.label() }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    FILTER_OVERLAY_IMPORTS,
    OVERLAY_CONTENT_IMPORTS,
    OverlayBackOrCloseDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayRouterOutletComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class FilterOverlayShellComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
}

@Component({
  selector: 'app-filter-overlay-default-example',
  template: `
    <div #floatingAction="etFloatingAction" etFloatingAction>
      <h2>Teams</h2>
      <p>
        Applied: <code>{{ appliedLabel() }}</code> · {{ visibleTeams().length }} of {{ TEAMS.length }} teams
      </p>

      <div etFloatingActionAnchor>
        <button (click)="openFilters()" et-button etFloatingActionTrigger>
          Filters
          @if (filters.activeFilterCount() > 0) {
            <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
          }
        </button>
      </div>

      <ul etFloatingActionScope>
        @for (team of visibleTeams(); track team.name) {
          <li>{{ team.name }} - {{ REGION_LABELS[team.region] }} · {{ DIVISION_LABELS[team.division] }}</li>
        } @empty {
          <li>No teams match these filters.</li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHIP_IMPORTS, FLOATING_ACTION_IMPORTS],
})
export class FilterOverlayDefaultExampleComponent {
  private overlayManager = injectOverlayManager();

  protected readonly TEAMS = TEAMS;
  protected readonly REGION_LABELS = REGION_LABELS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;

  protected filters = createTeamFilters().observe();

  protected visibleTeams = computed(() => matchTeams(this.filters.value()));

  protected appliedLabel = computed(() => {
    const { search, region, division } = this.filters.value();

    return `search=${search || '-'} region=${region} division=${division}`;
  });

  protected openFilters() {
    this.overlayManager.open(FilterOverlayShellComponent, {
      strategies: dialogOverlayStrategy({ width: 420, height: 'min(520px, 80vh)' }),
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: FilterOverlayMainPageComponent },
            { path: '/region', component: FilterOverlayRegionPageComponent },
            { path: '/division', component: FilterOverlayDivisionPageComponent },
          ],
        }),
        provideFilterOverlay({
          queryForm: this.filters,
          preview: createLocalPreview,
          maxCountedHits: 12,
        }),
      ],
    });
  }
}

const createLocalPreview = (draftValue: Signal<TeamFilterValue>) => {
  const settled = signal<number | null>(null);
  const pending = signal(true);

  toObservable(draftValue)
    .pipe(
      tap(() => pending.set(true)),
      switchMap((value) => timer(400).pipe(map(() => value))),
      tap((value) => {
        settled.set(matchTeams(value).length);
        pending.set(false);
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    loading: computed(() => pending()),
    hasError: computed(() => false),
    totalHits: computed(() => settled()),
  } satisfies FilterOverlayPreview;
};
