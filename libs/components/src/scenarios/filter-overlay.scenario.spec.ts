import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField } from '@angular/forms/signals';
import { provideRouter } from '@angular/router';
import { injectLocale, provideColorThemes } from '@ethlete/core';
import { createGetQuery, createQueryClient, defineQueryForm, queryField } from '@ethlete/query';
import {
  DEFAULT_FILTER_OVERLAY_LABELS,
  FilterOverlayConfig,
  dialogOverlayStrategy,
  FILTER_OVERLAY_ERROR_CODES,
  FILTER_OVERLAY_IMPORTS,
  FILTER_OVERLAY_LABELS,
  FILTER_OVERLAY_TOKEN,
  FilterOverlayResetDirective,
  FilterOverlayResult,
  FilterOverlaySubmitDirective,
  FilterOverlayValueOf,
  filterOverlayLabelsForLocale,
  filterOverlayPreviewFromQuery,
  GERMAN_FILTER_OVERLAY_LABELS,
  injectFilterOverlay,
  injectFilterOverlayLabels,
  injectOverlayManager,
  OverlayRef,
  provideFilterOverlay,
  provideFilterOverlayLabels,
  provideOverlay,
  resolveFilterOverlaySubmitButton,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const TEAM_FILTER_FIELDS = {
  search: queryField<string>({ defaultValue: '' }),
  region: queryField<string>({ defaultValue: 'all' }),
  page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'region'] }),
};

const createTeamFilters = () => defineQueryForm({ fields: TEAM_FILTER_FIELDS, queryParamPrefix: 'teams' });

type TeamFilterValue = FilterOverlayValueOf<ReturnType<typeof createTeamFilters>>;

const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'filter-overlay-scenario' });
const countTeams = createGetQuery(client)<{
  queryParams: { search: string; region: string; limit: number };
  response: { totalHits: number };
}>('/teams');
const countTeamsLoosely = createGetQuery(client)<{
  queryParams: { region: string };
  response: { total: number };
}>('/teams/count');

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const type = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

@Component({
  selector: 'et-scenario-region-badge',
  template: `{{ filters?.activeFilterCount() ?? 'none' }}`,
})
class RegionBadgeComponent {
  filters = inject(FILTER_OVERLAY_TOKEN, { optional: true });
}

@Component({
  selector: 'et-scenario-team-filters',
  imports: [FILTER_OVERLAY_IMPORTS, FormField, RegionBadgeComponent],
  template: `
    <input [formField]="filters.draft.fields.search" class="search" />
    <select [formField]="filters.draft.fields.region" class="region">
      <option value="all">All</option>
      <option value="eu">Europe</option>
      <option value="na">North America</option>
    </select>
    <et-scenario-region-badge class="badge" />
    <button (click)="filters.discard()" class="discard" type="button">Close</button>
    <button class="reset" etFilterOverlayReset>{{ filters.labels().reset }}</button>
    <button #submit="etFilterOverlaySubmit" class="submit" etFilterOverlaySubmit>{{ submit.label() }}</button>
  `,
})
class TeamFiltersComponent {
  filters = injectFilterOverlay<TeamFilterValue>();
  labels = inject(FILTER_OVERLAY_LABELS);
}

@Component({
  selector: 'et-scenario-teams-page',
  template: `<span class="applied">{{ filters.value().search }}|{{ filters.value().region }}</span>`,
})
class TeamsPageComponent {
  private overlayManager = injectOverlayManager();
  filters = createTeamFilters().observe({ writeToQueryParams: false, syncOnNavigation: false });
  results: FilterOverlayResult<TeamFilterValue>[] = [];
  withPreview = signal(true);

  open(extra: Partial<FilterOverlayConfig<typeof TEAM_FILTER_FIELDS>> = {}) {
    const ref: OverlayRef<TeamFiltersComponent, FilterOverlayResult<TeamFilterValue>> = this.overlayManager.open(
      TeamFiltersComponent,
      {
        strategies: dialogOverlayStrategy(),
        autoFocus: false,
        providers: [
          provideFilterOverlay({
            queryForm: this.filters,
            preview: this.withPreview()
              ? filterOverlayPreviewFromQuery({
                  queryCreator: countTeams,
                  args: (value: TeamFilterValue) =>
                    value.search === 'x' ? null : { queryParams: { ...value, limit: 1 } },
                })
              : undefined,
            maxCountedHits: 100,
            ...extra,
          }),
        ],
      },
    );

    ref.afterClosed().subscribe((result) => result && this.results.push(result));

    return ref;
  }
}

@Component({
  selector: 'et-scenario-stray-filter-controls',
  imports: [FilterOverlaySubmitDirective, FilterOverlayResetDirective],
  template: `<button etFilterOverlaySubmit>Apply</button>`,
})
class StraySubmitComponent {}

@Component({
  selector: 'et-scenario-filter-labels',
  template: `{{ labels().apply }}|{{ labels().reset }}`,
})
class FilterLabelsComponent {
  labels = injectFilterOverlayLabels();
}

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const requestTo = (request: { urlWithParams: string }) => new URL(request.urlWithParams);

const countRequest = (http: HttpTestingController, search: string, region: string) =>
  http.expectOne((request) => {
    const url = requestTo(request);

    return (
      url.pathname === '/teams' &&
      (url.searchParams.get('search') ?? '') === search &&
      url.searchParams.get('region') === region
    );
  });

describe('filter overlay scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemes(TEST_COLOR_THEMES),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', children: [] }]),
    ],
  });

  it('edits a draft with a live count, then applies it to the page filters on submit', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamsPageComponent);
    const page = fixture.componentInstance;

    s.tick();
    const ref = page.open();

    settle(s);
    const submit = query<HTMLButtonElement>('.submit');

    expect(submit.getAttribute('type')).toBe('button');
    expect(submit.disabled).toBe(true);
    expect(text(submit)).toBe(DEFAULT_FILTER_OVERLAY_LABELS.loading);
    expect(query<HTMLButtonElement>('.reset').disabled).toBe(true);
    expect(text(query('.reset'))).toBe('Reset');

    countRequest(http, '', 'all').flush({ totalHits: 24 });
    settle(s);

    expect(text(submit)).toBe('Show 24 results');
    expect(submit.disabled).toBe(false);

    const region = query<HTMLSelectElement>('.region');

    region.value = 'eu';
    region.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s);

    expect(text(query('.badge'))).toBe('1');
    expect(query<HTMLButtonElement>('.reset').disabled).toBe(false);
    expect(text(query('.applied', fixture.nativeElement))).toBe('|all');

    countRequest(http, '', 'eu').flush({ totalHits: 1 });
    settle(s);
    expect(text(submit)).toBe('Show one result');

    type(s, query<HTMLInputElement>('.search'), 'team-a');
    settle(s);
    countRequest(http, 'team-a', 'eu').flush({ totalHits: 0 });
    settle(s);
    expect(text(submit)).toBe('No results found');
    expect(submit.disabled).toBe(true);

    type(s, query<HTMLInputElement>('.search'), 'team');
    settle(s);
    countRequest(http, 'team', 'eu').flush({ totalHits: 500 });
    settle(s);
    expect(text(submit)).toBe('Show more than 100 results');

    submit.click();
    settle(s);
    fixture.detectChanges();

    expect(page.results).toEqual([{ didUpdate: true, value: { search: 'team', region: 'eu', page: 1 } }]);
    expect(page.filters.value()).toEqual({ search: 'team', region: 'eu', page: 1 });
    expect(text(query('.applied', fixture.nativeElement))).toBe('team|eu');
    expect(document.querySelector('.submit')).toBeNull();
    expect(ref.componentInstance()).toBeNull();

    fixture.destroy();
    http.verify();
  });

  it('discards the draft on close and resets to the defaults without closing', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamsPageComponent);
    const page = fixture.componentInstance;

    page.withPreview.set(false);
    s.tick();
    page.filters.setValue({ search: 'team-a', region: 'na', page: 3 });
    s.tick();
    page.open();
    settle(s);

    expect(query<HTMLInputElement>('.search').value).toBe('team-a');
    expect(text(query('.submit'))).toBe('Show results');
    expect(query<HTMLButtonElement>('.submit').disabled).toBe(false);

    query('.reset').click();
    settle(s);

    expect(query<HTMLInputElement>('.search').value).toBe('');
    expect(query<HTMLSelectElement>('.region').value).toBe('all');
    expect(query<HTMLButtonElement>('.reset').disabled).toBe(true);
    expect(document.querySelector('.submit')).not.toBeNull();

    query('.discard').click();
    settle(s);

    expect(page.results).toEqual([{ didUpdate: false }]);
    expect(page.filters.value()).toEqual({ search: 'team-a', region: 'na', page: 3 });

    page.open();
    settle(s);
    type(s, query<HTMLInputElement>('.search'), 'x');
    s.keydown('Escape');
    settle(s);

    expect(document.querySelector('.submit')).toBeNull();
    expect(page.filters.value().search).toBe('team-a');

    fixture.destroy();
    http.verify();
  });

  it('skips the count for a draft the preview declines, and lets the app own the submit button', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamsPageComponent);
    const page = fixture.componentInstance;

    s.tick();
    page.open({
      submitButton: (state, labels) => {
        const button = resolveFilterOverlaySubmitButton(state, labels);

        return state.totalHits === 0 ? { label: 'Nothing yet, apply anyway', disabled: false } : button;
      },
    });
    settle(s);
    countRequest(http, '', 'all').flush({ totalHits: 0 });
    settle(s);

    expect(text(query('.submit'))).toBe('Nothing yet, apply anyway');
    expect(query<HTMLButtonElement>('.submit').disabled).toBe(false);

    type(s, query<HTMLInputElement>('.search'), 'x');
    settle(s);
    http.expectNone((request) => requestTo(request).searchParams.get('search') === 'x');
    expect(text(query('.submit'))).toBe('Show results');

    type(s, query<HTMLInputElement>('.search'), 'team-b');
    settle(s);
    countRequest(http, 'team-b', 'all').flush({ message: 'Down' }, { status: 500, statusText: 'x' });
    settle(s);
    s.errors.splice(0);

    expect(text(query('.submit'))).toBe('An error occurred');
    expect(query<HTMLButtonElement>('.submit').disabled).toBe(true);

    fixture.destroy();
    http.verify();
  });

  it('reads the total from a custom response shape and reports a response without one', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamsPageComponent);
    const page = fixture.componentInstance;

    s.tick();
    page.open({
      preview: filterOverlayPreviewFromQuery({
        queryCreator: countTeamsLoosely,
        args: (value: TeamFilterValue) => ({ queryParams: { region: value.region } }),
        toTotalHits: (response) => response.total,
      }),
    });
    settle(s);
    http.expectOne((request) => requestTo(request).pathname === '/teams/count').flush({ total: 7 });
    settle(s);

    expect(text(query('.submit'))).toBe('Show 7 results');

    query('.discard').click();
    settle(s);

    page.open({
      preview: filterOverlayPreviewFromQuery({
        queryCreator: countTeamsLoosely,
        args: (value: TeamFilterValue) => ({ queryParams: { region: value.region } }),
      }),
    });
    settle(s);
    http
      .match((request) => requestTo(request).pathname === '/teams/count')
      .forEach((request) => request.flush({ total: 7 }));
    settle(s);
    s.errors.splice(0);

    expect(text(query('.submit'))).toBe('Show results');

    const region = query<HTMLSelectElement>('.region');

    region.value = 'na';
    region.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s);
    http.expectOne((request) => requestTo(request).searchParams.get('region') === 'na').flush({ total: 2 });
    settle(s);

    expect(s.errors.splice(0).map((entry) => String(entry.error))).toEqual([
      expect.stringContaining('has no `totalHits` property'),
    ]);
    expect(text(query('.submit'))).toBe('Show results');

    fixture.destroy();
    http.verify();
  });

  it('throws for a submit control outside a filter overlay', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(StraySubmitComponent)).toThrow(
      `ET${FILTER_OVERLAY_ERROR_CODES.MISSING_FILTER_OVERLAY}`,
    );
    s.tick(1);
    s.errors.splice(0);
  });

  it('follows the locale into the German labels', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TeamsPageComponent);
    const page = fixture.componentInstance;

    TestBed.runInInjectionContext(() => injectLocale().currentLocale.set('de-DE'));
    s.tick();
    page.open();
    settle(s);
    countRequest(http, '', 'all').flush({ totalHits: 3 });
    settle(s);

    expect(text(query('.submit'))).toBe(GERMAN_FILTER_OVERLAY_LABELS.many(3));
    expect(text(query('.reset'))).toBe(GERMAN_FILTER_OVERLAY_LABELS.reset);
    expect(filterOverlayLabelsForLocale('de-AT')).toBe(GERMAN_FILTER_OVERLAY_LABELS);

    fixture.destroy();
    http.verify();
  });
});

describe('filter overlay label override scenarios', () => {
  const scenario = useScenario({
    providers: [provideFilterOverlayLabels({ apply: 'Voir les résultats', reset: 'Réinitialiser' })],
  });

  it('overrides some labels app-wide and keeps the rest', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FilterLabelsComponent);

    s.tick();
    expect(text(fixture.nativeElement)).toBe('Voir les résultats|Réinitialiser');
    expect(fixture.componentInstance.labels().loading).toBe(DEFAULT_FILTER_OVERLAY_LABELS.loading);
  });
});
