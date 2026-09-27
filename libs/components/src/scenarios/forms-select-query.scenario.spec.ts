import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { createGetQuery, createQueryClient, def, V2QueryClient } from '@ethlete/query';
import {
  provideOverlay,
  SELECT_FILTER_MODES,
  SelectComponent,
  SelectDirective,
  SelectOptionComponent,
  SelectOptionsDirective,
  selectOptionsFromQuery,
  selectOptionsFromV2Query,
  SelectSearchDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Member = { id: number; name: string };
type MembersResponse = { items: Member[]; page: number; totalPages: number };

const member = (id: number): Member => ({ id, name: `Member ${id}` });

@Component({
  selector: 'et-scenario-assignee-picker',
  imports: [SelectComponent, SelectOptionComponent, SelectSearchDirective, SelectOptionsDirective, FormField],
  template: `
    <et-select [formField]="task.assignee" [etSelectOptions]="members" aria-label="Assignee">
      <input etSelectSearch />
      @for (member of members.options(); track member.id) {
        <et-select-option [value]="member.id">{{ member.name }}</et-select-option>
      }
    </et-select>
  `,
})
class AssigneePickerComponent {
  model = signal<{ assignee: number | null }>({ assignee: null });
  task = form(this.model);
  members = selectOptionsFromQuery({
    queryCreator: createGetQuery(
      createQueryClient({ baseUrl: 'https://api.example.com', name: 'select-query-scenario' }),
    )<{ queryParams: { q: string; page: number }; response: MembersResponse }>('/members'),
    args: (query, page) => ({ queryParams: { q: query(), page: page() } }),
    toOptions: (response) => response.items,
    toHasMore: (response) => response.page < response.totalPages,
    debounceTime: 200,
  });
}

type LegacyArgs = { queryParams: { q: string } };

@Component({
  selector: 'et-scenario-legacy-assignee-picker',
  imports: [SelectComponent, SelectOptionComponent, SelectSearchDirective],
  template: `
    <et-select
      [(value)]="assignee"
      [loading]="members.loading()"
      [error]="members.error()"
      [hasMoreItems]="members.hasMore()"
      [filterMode]="externalFilter"
      (queryChange)="members.setQuery($event)"
      (loadMore)="members.loadMore()"
      aria-label="Assignee"
    >
      <input etSelectSearch />
      @for (member of members.options(); track member.id) {
        <et-select-option [value]="member.id">{{ member.name }}</et-select-option>
      }
    </et-select>
  `,
})
class LegacyAssigneePickerComponent {
  externalFilter = SELECT_FILTER_MODES.EXTERNAL;
  assignee = signal<number | null>(null);
  fail = signal(false);
  requested: string[] = [];
  members = selectOptionsFromV2Query({
    queryCreator: new V2QueryClient({ baseRoute: 'https://api.example.com' }).get({
      route: '/members',
      types: { args: def<LegacyArgs>(), response: def<{ items: Member[] }>() },
    }),
    args: (query) => {
      this.requested.push(query());

      return {
        queryParams: { q: query() },
        mock: this.fail()
          ? {
              delay: 5,
              error: {
                url: 'https://api.example.com/members',
                status: 503,
                statusText: 'Unavailable',
                detail: { message: 'Directory offline' },
                httpErrorResponse: null as never,
              },
            }
          : {
              delay: 5,
              response: { items: [member(1), member(2), member(3)].filter((m) => m.name.includes(query())) },
            },
      };
    },
    toOptions: (response) => response.items,
    minQueryLength: 1,
    debounceTime: 100,
  });
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const pane = () => queryAll('.et-overlay-runtime-pane').at(-1) ?? document.createElement('div');

const param = (request: { urlWithParams: string }, name: string) =>
  new URL(request.urlWithParams).searchParams.get(name);

const optionLabels = () => queryAll('[role="option"]', pane()).map(text);

const type = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

describe('forms select query scenarios', () => {
  describe('with the signals query client', () => {
    const scenario = useScenario({
      providers: [
        provideOverlay(),
        provideColorThemes(TEST_COLOR_THEMES),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    it('searches, pages and reports errors through an options bundle', () => {
      const s = scenario();
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(AssigneePickerComponent);
      const host = fixture.nativeElement as HTMLElement;
      const app = fixture.componentInstance;
      const select = fixture.debugElement.query((node) => node.name === 'et-select').injector.get(SelectDirective);

      s.tick();

      expect(select.filterMode()).toBe(SELECT_FILTER_MODES.EXTERNAL);
      http
        .expectOne((request) => param(request, 'q') === null && param(request, 'page') === '1')
        .flush({ items: [member(1), member(2)], page: 1, totalPages: 2 });
      s.tick();

      const input = query<HTMLInputElement>('input[etSelectSearch]', host);

      query('.et-select-trigger', host).click();
      s.tick();
      s.tick(16);
      s.frame(4);

      expect(optionLabels()).toEqual(['Member 1', 'Member 2']);
      expect(text(query('.et-select-load-more'))).toBe('Load more');

      query<HTMLButtonElement>('.et-select-load-more').click();
      s.tick();
      expect(select.loading()).toBe(true);
      http.expectOne((request) => param(request, 'page') === '2').flush({ items: [member(3)], page: 2, totalPages: 2 });
      s.tick();
      s.frame(2);

      expect(optionLabels()).toEqual(['Member 1', 'Member 2', 'Member 3']);
      expect(document.querySelector('.et-select-load-more')).toBeNull();

      type(s, input, '7');
      s.tick(200);
      expect(app.members.query()).toBe('7');

      http
        .expectOne((request) => param(request, 'q') === '7' && param(request, 'page') === '1')
        .flush({ message: 'Search index rebuilding' }, { status: 500, statusText: 'Server Error' });
      s.tick();
      s.frame(2);

      expect(text(query('.et-select-state--error'))).toBe('Search index rebuilding');
      expect(s.errors).toEqual([]);

      type(s, input, '4');
      s.tick(200);
      http
        .expectOne((request) => param(request, 'q') === '4' && param(request, 'page') === '1')
        .flush({ items: [member(4)], page: 1, totalPages: 1 });
      s.tick();
      s.frame(2);

      expect(optionLabels()).toEqual(['Member 4']);

      s.keydown('ArrowDown', input);
      s.keydown('Enter', input);
      s.tick();
      s.frame(4);

      expect(app.model().assignee).toBe(4);
      http.verify();
      fixture.destroy();
      s.tick(1000);
      s.frame(4);
    });
  });

  describe('with the legacy query client', () => {
    const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

    const hop = async (s: Scenario, ms: number) => {
      s.tick(ms);
      await new Promise<void>((resolve) => setImmediate(resolve));
      s.tick(10);
      await new Promise<void>((resolve) => setImmediate(resolve));
      s.tick(10);
    };

    it('skips short queries, loads matches and shows a failed search', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(LegacyAssigneePickerComponent);
      const host = fixture.nativeElement as HTMLElement;
      const app = fixture.componentInstance;

      s.tick();

      const input = query<HTMLInputElement>('input[etSelectSearch]', host);

      expect(app.requested).toEqual([]);

      type(s, input, '2');
      await hop(s, 100);
      s.frame(4);

      expect(app.requested).toEqual(['2']);
      expect(optionLabels()).toEqual(['Member 2']);

      s.keydown('ArrowDown', input);
      s.keydown('Enter', input);
      s.tick();
      s.frame(4);
      expect(app.assignee()).toBe(2);

      app.fail.set(true);
      type(s, input, 'Member');
      await hop(s, 100);
      s.frame(4);

      expect(app.members.error()).toBe('Directory offline');
      expect(text(query('.et-select-state--error'))).toBe('Directory offline');

      fixture.destroy();
      s.tick(1000);
      s.frame(4);
    });
  });
});
