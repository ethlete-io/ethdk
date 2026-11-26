import { Component, ViewEncapsulation } from '@angular/core';
import { PagedQueryTriggerDirective, SCROLLABLE_IMPORTS } from '@ethlete/components';
import { createGetQuery, createPagedQueryStack, createQueryClient, ethletePaginationAdapter } from '@ethlete/query';
import { Paginated } from '@ethlete/types';

type Match = { id: number; home: string; away: string };

type MatchesArgs = {
  queryParams: { page: number; limit: number };
  response: Paginated<Match>;
};

const client = createQueryClient({ baseUrl: 'https://paged-query.demo', name: 'pagedQueryTriggerExample' });

const getMatches = createGetQuery(client)<MatchesArgs>('/matches');

@Component({
  selector: 'app-paged-query-trigger-default-example',
  template: `
    <h2>Match rail</h2>
    <et-scrollable class="app-paged-rail">
      @for (match of rail.items(); track match.id) {
        <div class="app-paged-card app-paged-card--rail">
          <span>#{{ match.id }}</span>
          <span>{{ match.home }} - {{ match.away }}</span>
        </div>
      }
      <div #railTrigger="etPagedQueryTrigger" [etPagedQueryTrigger]="rail" rootMargin="200px"></div>
    </et-scrollable>
    <p>
      {{ rail.items().length }} matches -
      {{ railTrigger.exhausted() ? 'all loaded' : railTrigger.loading() ? 'loading…' : 'scroll for more' }}
    </p>

    <h2>Vertical list</h2>
    <et-scrollable class="app-paged-list" direction="vertical">
      @for (match of list.items(); track match.id) {
        <div class="app-paged-card">
          <span>#{{ match.id }}</span>
          <span>{{ match.home }} - {{ match.away }}</span>
        </div>
      }
      <div #listTrigger="etPagedQueryTrigger" [etPagedQueryTrigger]="list" rootMargin="200px"></div>
    </et-scrollable>
    <p>
      {{ list.items().length }} matches -
      {{ listTrigger.exhausted() ? 'all loaded' : listTrigger.loading() ? 'loading…' : 'scroll for more' }}
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLABLE_IMPORTS, PagedQueryTriggerDirective],
  styles: `
    .app-paged-card {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: 4px;
      padding: 12px 16px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 12px;
    }

    .app-paged-card--rail {
      inline-size: 180px;
    }

    .app-paged-rail .et-scrollable-container {
      gap: 12px;
    }

    .app-paged-list {
      max-inline-size: 420px;
    }

    .app-paged-list .et-scrollable-container {
      block-size: 260px;
      gap: 8px;
    }
  `,
})
export class PagedQueryTriggerDefaultExampleComponent {
  protected rail = createPagedQueryStack({
    queryCreator: getMatches,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 6 } }),
  });

  protected list = createPagedQueryStack({
    queryCreator: getMatches,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
  });
}
