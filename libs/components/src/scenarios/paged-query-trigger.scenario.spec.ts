import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createGetQuery,
  createPagedQueryStack,
  createQueryClient,
  ethletePaginationAdapter,
  withPolling,
} from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { PagedQueryTriggerDirective, ScrollableComponent } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

type Match = { id: number };
type MatchesArgs = { queryParams: { page: number }; response: Paginated<Match> };

const getMatches = createGetQuery(
  createQueryClient({ baseUrl: 'https://api.example.com', name: 'paged-trigger-scenario' }),
)<MatchesArgs>('/matches');

const page = (currentPage: number, totalPageCount: number): Paginated<Match> => ({
  items: [{ id: currentPage * 10 + 1 }, { id: currentPage * 10 + 2 }],
  currentPage,
  nextPage: currentPage < totalPageCount ? currentPage + 1 : null,
  totalPageCount,
  itemsPerPage: 2,
  totalHits: totalPageCount * 2,
});

@Component({
  selector: 'et-scenario-match-rail',
  imports: [ScrollableComponent, PagedQueryTriggerDirective],
  template: `
    <et-scrollable>
      @for (match of matches.items(); track match.id) {
        <div class="match">{{ match.id }}</div>
      }
      <div [etPagedQueryTrigger]="matches" rootMargin="400px" data-testid="trigger"></div>
    </et-scrollable>
  `,
})
class MatchRailComponent {
  matches = createPagedQueryStack({
    queryCreator: getMatches,
    responseNormalizer: ethletePaginationAdapter,
    args: (currentPage) => ({ queryParams: { page: currentPage } }),
    features: [withPolling({ interval: 5_000 })],
  });
}

const requestedPage = (request: { urlWithParams: string }) =>
  Number(new URL(request.urlWithParams).searchParams.get('page'));

describe('paged query trigger scenarios', () => {
  const scenario = useScenario({ providers: [provideHttpClient(), provideHttpClientTesting()] });

  it('loads the next page of a polled stack when the rail end scrolls into view', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MatchRailComponent);
    const rail = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector<HTMLElement>('[data-testid="trigger"]');

    if (!trigger) throw new Error('no trigger');

    s.tick();
    http.expectOne((request) => requestedPage(request) === 1).flush(page(1, 3));
    s.tick();

    expect(s.observedElements()).toContain(trigger);

    s.intersect(trigger, true);

    expect(trigger.hasAttribute('data-loading')).toBe(true);
    http.expectOne((request) => requestedPage(request) === 2).flush(page(2, 3));
    s.tick();

    expect(rail.matches.items().map((match) => match.id)).toEqual([11, 12, 21, 22]);
    expect(host.querySelectorAll('.match')).toHaveLength(4);

    s.tick(5_000);

    const polled = http.match(() => true);

    expect(polled.map((polledRequest) => requestedPage(polledRequest.request)).sort()).toEqual([1, 2]);
    polled.forEach((polledRequest) => polledRequest.flush(page(requestedPage(polledRequest.request), 3)));
    s.tick();

    expect(rail.matches.items().map((match) => match.id)).toEqual([11, 12, 21, 22]);
    expect(rail.matches.canFetchNextPage()).toBe(true);

    s.intersect(trigger, true);
    http.expectOne((request) => requestedPage(request) === 3).flush(page(3, 3));
    s.tick();

    expect(trigger.hasAttribute('data-exhausted')).toBe(true);
    expect(s.observedElements()).not.toContain(trigger);

    http.verify();
    fixture.destroy();
    s.frame(2);
  });
});
