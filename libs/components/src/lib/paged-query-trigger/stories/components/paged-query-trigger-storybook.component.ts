import { Component, input, ViewEncapsulation } from '@angular/core';
import { createGetQuery, createPagedQueryStack, createQueryClient, ethletePaginationAdapter } from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { ScrollableComponent } from '../../../scrollable/scrollable.component';
import { PagedQueryTriggerDirective } from '../../paged-query-trigger.directive';
import { MOCK_PAGED_QUERY_BASE_URL, MockMatch } from './paged-query-mock';

type MatchesArgs = {
  queryParams: { page: number; limit: number; delay: number };
  response: Paginated<MockMatch>;
};

const client = createQueryClient({ baseUrl: MOCK_PAGED_QUERY_BASE_URL, name: 'pagedQueryTriggerDemo' });

const getMatches = createGetQuery(client)<MatchesArgs>('/matches');

@Component({
  selector: 'et-sb-paged-query-trigger',
  template: `
    <div class="flex flex-col gap-10 p-8 font-sans">
      <section class="flex flex-col gap-3">
        <h2 class="text-h6">Match rail</h2>
        <et-scrollable data-testid="rail">
          @for (match of rail.items(); track match.id) {
            <div [style.inline-size.px]="180" class="et-sb-paged-card" data-testid="rail-item">
              <span class="text-subline opacity-60">#{{ match.id }}</span>
              <span>{{ match.home }} - {{ match.away }}</span>
            </div>
          }
          <div
            #railTrigger="etPagedQueryTrigger"
            [etPagedQueryTrigger]="rail"
            [rootMargin]="rootMargin()"
            class="et-sb-paged-sentinel"
            data-testid="rail-trigger"
          ></div>
        </et-scrollable>
        <p class="text-small opacity-60" data-testid="rail-status">
          {{ rail.items().length }} matches ·
          {{ railTrigger.exhausted() ? 'all loaded' : railTrigger.loading() ? 'loading…' : 'scroll for more' }}
        </p>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-h6">Vertical list</h2>
        <et-scrollable [style.max-inline-size.px]="420" direction="vertical" data-testid="list">
          @for (match of list.items(); track match.id) {
            <div class="et-sb-paged-card" data-testid="list-item">
              <span class="text-subline opacity-60">#{{ match.id }}</span>
              <span>{{ match.home }} - {{ match.away }}</span>
            </div>
          }
          <div
            #listTrigger="etPagedQueryTrigger"
            [etPagedQueryTrigger]="list"
            [rootMargin]="rootMargin()"
            class="et-sb-paged-sentinel"
            data-testid="list-trigger"
          ></div>
        </et-scrollable>
        <p class="text-small opacity-60" data-testid="list-status">
          {{ list.items().length }} matches ·
          {{ listTrigger.exhausted() ? 'all loaded' : listTrigger.loading() ? 'loading…' : 'scroll for more' }}
        </p>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollableComponent, PagedQueryTriggerDirective],
  styles: `
    .et-sb-paged-card {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      gap: 4px;
      padding: 12px 16px;
      border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      border-radius: 12px;
    }

    [data-testid='rail'] .et-scrollable-container {
      gap: 12px;
    }

    [data-testid='list'] .et-scrollable-container {
      block-size: 260px;
      gap: 8px;
    }

    .et-sb-paged-sentinel {
      flex-shrink: 0;
      inline-size: 1px;
      block-size: 1px;
    }
  `,
})
export class PagedQueryTriggerStorybookComponent {
  public rootMargin = input('200px');
  public delay = input(600);

  protected rail = createPagedQueryStack({
    queryCreator: getMatches,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 6, delay: this.delay() } }),
  });

  protected list = createPagedQueryStack({
    queryCreator: getMatches,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5, delay: this.delay() } }),
  });
}
