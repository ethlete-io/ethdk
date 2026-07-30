import { Component, Signal, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { map, switchMap, tap, timer } from 'rxjs';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { createQueryForm, queryField } from '@ethlete/query';
import { BUTTON_IMPORTS } from '../../button';
import { CHIP_IMPORTS } from '../../chip';
import { FLOATING_ACTION_IMPORTS } from '../../floating-action';
import {
  OverlayBodyComponent,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayHeaderTemplateDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
  injectOverlayManager,
} from '../../overlay';
import {
  OverlayBackOrCloseDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  provideOverlayRouter,
} from '../../overlay/routing';
import { dialogOverlayStrategy } from '../../overlay/strategies';
import { FILTER_OVERLAY_IMPORTS } from '../filter-overlay.imports';
import { FilterOverlayPreview } from '../filter-overlay.types';
import { FilterOverlayValueOf, injectFilterOverlay, provideFilterOverlay } from '../filter-overlay';

// ─── The page's filter state ─────────────────────────────────────────────────

export const TEAM_FILTER_FIELDS = {
  search: queryField<string>({ defaultValue: '' }),
  region: queryField<string>({ defaultValue: 'all' }),
  division: queryField<string>({ defaultValue: 'all' }),
  page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'region', 'division'] }),
};

/** The filters' value shape, named without naming the field map — see `FilterOverlayValueOf`. */
const createTeamFilters = () => createQueryForm({ fields: TEAM_FILTER_FIELDS, queryParamPrefix: 'teams' });
export type TeamFilterValue = FilterOverlayValueOf<ReturnType<typeof createTeamFilters>>;

const REGIONS = ['all', 'eu', 'na', 'apac'];
const DIVISIONS = ['all', 'first', 'second', 'youth'];

// ─── The overlay's routed pages ──────────────────────────────────────────────

@Component({
  selector: 'et-sb-filter-overlay-page-main',
  template: `
    <ng-template etOverlayHeaderTemplate>Filters</ng-template>

    <div class="flex flex-col gap-4">
      <!-- Plain buttons rather than form controls: this story is about the draft/apply contract, and binding a
           draft field to a real input is covered by the forms guides. -->
      <div class="flex flex-col gap-2">
        <span class="text-small opacity-60">Search</span>
        <div class="flex flex-wrap gap-2">
          @for (term of SEARCH_TERMS; track term) {
            <button
              [variant]="filters.draft.value().search === term ? 'filled' : 'outline'"
              (click)="filters.draft.patchValue({ search: term })"
              et-button
              size="xs"
            >
              {{ term || 'any' }}
            </button>
          }
        </div>
      </div>

      <!-- Each of these opens a page of its own, which is what the overlay router is for: a long option list
           does not belong squeezed into the panel next to everything else. -->
      <button etOverlayRouterLink="/region" et-button variant="outline" size="sm">
        Region — {{ filters.draft.value().region }}
      </button>

      <button etOverlayRouterLink="/division" et-button variant="outline" size="sm">
        Division — {{ filters.draft.value().division }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, OverlayRouterLinkDirective, BUTTON_IMPORTS],
})
export class FilterOverlayMainPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();

  protected readonly SEARCH_TERMS = ['', 'chemie', 'united', 'city'];
}

@Component({
  selector: 'et-sb-filter-overlay-page-region',
  template: `
    <ng-template etOverlayHeaderTemplate>Region</ng-template>

    <div class="flex flex-col items-start gap-2">
      @for (region of REGIONS; track region) {
        <button
          [variant]="filters.draft.value().region === region ? 'filled' : 'outline'"
          (click)="filters.draft.patchValue({ region })"
          et-button
          size="sm"
        >
          {{ region }}
        </button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, BUTTON_IMPORTS],
})
export class FilterOverlayRegionPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
  protected readonly REGIONS = REGIONS;
}

@Component({
  selector: 'et-sb-filter-overlay-page-division',
  template: `
    <ng-template etOverlayHeaderTemplate>Division</ng-template>

    <div class="flex flex-col items-start gap-2">
      @for (division of DIVISIONS; track division) {
        <button
          [variant]="filters.draft.value().division === division ? 'filled' : 'outline'"
          (click)="filters.draft.patchValue({ division })"
          et-button
          size="sm"
        >
          {{ division }}
        </button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective, BUTTON_IMPORTS],
})
export class FilterOverlayDivisionPageComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
  protected readonly DIVISIONS = DIVISIONS;
}

// ─── The overlay shell ───────────────────────────────────────────────────────

@Component({
  selector: 'et-sb-filter-overlay-shell',
  template: `
    <div etOverlayHeader>
      <div class="flex items-center gap-2">
        <button aria-label="Back" et-button etOverlayBackOrClose variant="transparent" size="sm">←</button>
        <h2 class="text-h6 font-title" etOverlayTitle>
          <et-overlay-route-header-template-outlet />
        </h2>
      </div>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet />
    </et-overlay-body>

    <div class="flex items-center justify-between gap-2" etOverlayFooter>
      <!-- Disabled while every field is at its default. The active filter count would be the wrong test here,
           because the query form leaves search out of it. -->
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
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayHeaderDirective,
    OverlayTitleDirective,
    OverlayBackOrCloseDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayRouterOutletComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class FilterOverlayShellComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
}

// ─── The page ────────────────────────────────────────────────────────────────

@Component({
  selector: 'et-sb-filter-overlay',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium font-sans">
      <div #floatingAction="etFloatingAction" class="flex flex-col gap-6 p-8" etFloatingAction>
        <div class="flex flex-col gap-2">
          <h2 class="text-h6 m-0">Teams</h2>
          <p class="text-small m-0 opacity-60">
            Applied: <code class="et-sb-applied">{{ appliedLabel() }}</code> · {{ visibleTeams().length }} of
            {{ TEAMS.length }} teams
          </p>
        </div>

        <div etFloatingActionAnchor>
          <button (click)="openFilters()" et-button etFloatingActionTrigger>
            Filters
            @if (filters.activeFilterCount() > 0) {
              <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
            }
          </button>
        </div>

        <ul class="m-0 flex flex-col gap-2 p-0" etFloatingActionScope>
          @for (team of visibleTeams(); track team.name) {
            <li class="list-none rounded-md p-3" style="background: var(--et-surface-background-solid)">
              {{ team.name }} — {{ team.region }} / {{ team.division }}
            </li>
          } @empty {
            <li class="list-none opacity-60">No teams match these filters.</li>
          }
        </ul>

        @for (paragraph of OUTRO; track $index) {
          <p [style.max-inline-size.px]="640" class="m-0 opacity-60">{{ paragraph }}</p>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHIP_IMPORTS, FLOATING_ACTION_IMPORTS, ProvideSurfaceDirective],
})
export class FilterOverlayStorybookComponent {
  private overlayManager = injectOverlayManager();
  public surface = input('dark');

  /** Turn the live result count off, to see the button fall back to a plain "Show results". */
  public withPreview = input(true);

  protected readonly TEAMS = TEAMS;
  protected readonly OUTRO = Array.from({ length: 10 }, () => LOREM);

  protected filters = createTeamFilters().observe();

  protected visibleTeams = computed(() => matchTeams(this.filters.value()));

  protected appliedLabel = computed(() => {
    const { search, region, division } = this.filters.value();

    return `search=${search || '—'} region=${region} division=${division}`;
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
          preview: this.withPreview() ? createLocalPreview : undefined,
          maxCountedHits: 6,
        }),
      ],
    });
  }
}

// Below the component on purpose — see the `no-template-literal-before-inline-template` lint rule.

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod nisl nec ultricies. Aenean vulputate ' +
  'eleifend tellus. Curabitur ullamcorper ultricies nisi.';

const TEAMS = [
  { name: 'Chemie Leipzig', region: 'eu', division: 'first' },
  { name: 'Roter Stern', region: 'eu', division: 'second' },
  { name: 'Altona 93', region: 'eu', division: 'youth' },
  { name: 'Portland Thorns', region: 'na', division: 'first' },
  { name: 'Cascadia United', region: 'na', division: 'second' },
  { name: 'Yokohama FM', region: 'apac', division: 'first' },
  { name: 'Melbourne City', region: 'apac', division: 'youth' },
  { name: 'Wellington Phoenix', region: 'apac', division: 'second' },
];

const matchTeams = (value: TeamFilterValue) =>
  TEAMS.filter(
    (team) =>
      (!value.search || team.name.toLowerCase().includes(value.search.toLowerCase())) &&
      (!value.region || value.region === 'all' || team.region === value.region) &&
      (!value.division || value.division === 'all' || team.division === value.division),
  );

/**
 * A stand-in for `filterOverlayPreviewFromQuery`: same shape, counted locally with a simulated delay so the
 * submit button's loading state is visible without the story depending on a server.
 */
const createLocalPreview = (draftValue: Signal<TeamFilterValue>) => {
  const settled = signal<number | null>(null);
  const pending = signal(true);

  toObservable(draftValue)
    .pipe(
      tap(() => pending.set(true)),
      // Stands in for a request's latency, so the button's loading state is actually visible.
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
