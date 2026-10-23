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

    <div class="app-filter-overlay-page">
      <div class="app-filter-overlay-links">
        <button etOverlayRouterLink="/region" et-button variant="outline" size="sm">
          Region: {{ REGION_LABELS[filters.draft.value().region] }}
        </button>

        <button etOverlayRouterLink="/division" et-button variant="outline" size="sm">
          Division: {{ DIVISION_LABELS[filters.draft.value().division] }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, OverlayRouterLinkDirective, BUTTON_IMPORTS],
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
    <div class="app-filter-overlay-header" etOverlayHeader>
      <button aria-label="Back" et-button etOverlayBackOrClose variant="transparent" size="sm">&larr;</button>
      <h2 etOverlayTitle>
        <et-overlay-route-header-template-outlet />
      </h2>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet />
    </et-overlay-body>

    <div class="app-filter-overlay-footer" etOverlayFooter>
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
  host: { class: 'app-filter-overlay-shell' },
  styles: `
    .app-filter-overlay-shell {
      --et-overlay-body-padding-block: 1.6rem;
    }

    .app-filter-overlay-header {
      display: flex;
      align-items: center;
      gap: 0.8rem;

      h2 {
        margin: 0;
        font-size: 1.8rem;
      }
    }

    .app-filter-overlay-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }

    .app-filter-overlay-page,
    .app-filter-overlay-links {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
    }

    .app-filter-overlay-links {
      align-items: flex-start;
      gap: 0.8rem;
    }
  `,
})
export class FilterOverlayShellComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
}

@Component({
  selector: 'app-filter-overlay-default-example',
  template: `
    <div #floatingAction="etFloatingAction" class="app-filter-overlay-demo" etFloatingAction>
      <div class="app-filter-overlay-toolbar">
        <div>
          <h2>Teams</h2>
          <p>{{ visibleTeams().length }} of {{ TEAMS.length }} teams</p>
        </div>

        <div etFloatingActionAnchor>
          <button (click)="openFilters()" et-button etFloatingActionTrigger>
            Filters
            @if (filters.activeFilterCount() > 0) {
              <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
            }
          </button>
        </div>
      </div>

      @if (appliedFilters().length) {
        <div class="app-example-row">
          @for (applied of appliedFilters(); track applied) {
            <et-chip size="sm">{{ applied }}</et-chip>
          }
        </div>
      }

      <ul class="app-filter-overlay-teams" etFloatingActionScope>
        @for (team of visibleTeams(); track team.name) {
          <li>
            <span>{{ team.name }}</span>
            <span class="app-filter-overlay-meta">
              {{ REGION_LABELS[team.region] }} · {{ DIVISION_LABELS[team.division] }}
            </span>
          </li>
        } @empty {
          <li class="app-filter-overlay-meta">No teams match these filters.</li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHIP_IMPORTS, FLOATING_ACTION_IMPORTS],
  styles: `
    .app-filter-overlay-demo {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
    }

    .app-filter-overlay-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.6rem;

      h2 {
        margin: 0;
        font-size: 2rem;
      }

      p {
        margin: 0.2rem 0 0;
        font-size: 1.4rem;
        color: var(--et-surface-color-muted-solid);
      }
    }

    .app-filter-overlay-teams {
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 0.8rem;

      li {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 1rem 1.4rem;
      }

      li + li {
        border-block-start: 1px solid var(--et-surface-border-solid);
      }
    }

    .app-filter-overlay-meta {
      font-size: 1.3rem;
      color: var(--et-surface-color-muted-solid);
    }
  `,
})
export class FilterOverlayDefaultExampleComponent {
  private overlayManager = injectOverlayManager();

  protected readonly TEAMS = TEAMS;
  protected readonly REGION_LABELS = REGION_LABELS;
  protected readonly DIVISION_LABELS = DIVISION_LABELS;

  protected filters = createTeamFilters().observe();

  protected visibleTeams = computed(() => matchTeams(this.filters.value()));

  protected appliedFilters = computed(() => {
    const { region, division } = this.filters.value();

    return [
      region !== 'all' ? REGION_LABELS[region] : null,
      division !== 'all' ? DIVISION_LABELS[division] : null,
    ].filter((label) => label !== null);
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
