import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import { CascaderComponent, cascaderFromQuery, CascaderNode, DEFAULT_CASCADER_LABELS, provideOverlay } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Unit = { id: number; name: string; leaf: boolean };
type UnitPath = { path: { id: number; name: string }[]; leaf: boolean };

const client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'cascader-query-scenario' });
const getUnits = createGetQuery(client)<{ queryParams: { parent: number | null }; response: { items: Unit[] } }>(
  '/units',
);
const searchUnits = createGetQuery(client)<{ queryParams: { q: string }; response: { matches: UnitPath[] } }>(
  '/units/search',
);

@Component({
  selector: 'et-scenario-org-unit-picker',
  styles: ['et-scrollbar { display: block; }'],
  encapsulation: ViewEncapsulation.None,
  imports: [CascaderComponent, FormField],
  template: `<et-cascader
    [formField]="assignment.unit"
    [dataSource]="units"
    aria-label="Unit"
    searchPlaceholder="Find a unit"
  />`,
})
class OrgUnitPickerComponent {
  model = signal<{ unit: number | null }>({ unit: null });
  assignment = form(this.model);
  units = cascaderFromQuery({
    queryCreator: getUnits,
    args: (parent: CascaderNode<number> | null) => ({ queryParams: { parent: parent?.value ?? null } }),
    toNodes: (response) => response.items.map((item) => ({ value: item.id, label: item.name, isLeaf: item.leaf })),
    search: {
      queryCreator: searchUnits,
      args: (query) => ({ queryParams: { q: query } }),
      toResults: (response) =>
        response.matches.map((match) =>
          match.path.map((part, index) => ({
            value: part.id,
            label: part.name,
            isLeaf: match.leaf && index === match.path.length - 1,
          })),
        ),
      minQueryLength: 2,
      debounceTime: 150,
    },
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

const param = (request: { urlWithParams: string }, name: string) =>
  new URL(request.urlWithParams).searchParams.get(name);

const node = (label: string) => {
  const found = queryAll('[role="treeitem"]').find((candidate) => text(candidate) === label);

  if (!found) throw new Error(`no node ${label} in ${queryAll('[role="treeitem"]').map(text).join(', ')}`);

  return found;
};

const settle = (s: Scenario, ms = 0) => {
  s.tick(ms);
  s.frame(2);
  s.tick();
};

const takeHttpErrors = (s: Scenario) =>
  s.errors.splice(0).map((entry) => entry.error instanceof HttpErrorResponse && entry.error.status);

describe('forms cascader query scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemes(TEST_COLOR_THEMES),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });

  it('loads each level through a query, retries a failed level and commits a searched leaf', () => {
    const s = scenario();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OrgUnitPickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);
    http.expectNone(() => true);

    query('[role="combobox"]', host).click();
    settle(s, 1000);

    expect(text(query('.et-cascader-state--loading'))).toBe(DEFAULT_CASCADER_LABELS.loading);
    http
      .expectOne((request) => request.url.endsWith('/units') && param(request, 'parent') === null)
      .flush({
        items: [
          { id: 1, name: 'Sales', leaf: false },
          { id: 2, name: 'Support', leaf: true },
        ],
      });
    settle(s);

    expect(queryAll('[role="treeitem"]').map(text)).toEqual(['Sales', 'Support']);

    node('Sales').click();
    settle(s);
    http
      .expectOne((request) => param(request, 'parent') === '1')
      .flush({ message: 'Units unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    settle(s);

    expect(text(query('.et-cascader-state--error .et-cascader-state-error-message'))).toBe('Units unavailable');
    expect(query('.et-cascader-state--error').getAttribute('role')).toBe('alert');
    expect(takeHttpErrors(s)).toEqual([503]);

    query<HTMLButtonElement>('.et-cascader-state--error button').click();
    settle(s);
    http
      .expectOne((request) => param(request, 'parent') === '1')
      .flush({
        items: [
          { id: 11, name: 'Inside Sales', leaf: true },
          { id: 12, name: 'Field Sales', leaf: true },
        ],
      });
    settle(s);
    expect(queryAll('[role="group"]')[1]?.getAttribute('aria-label')).toBe('Sales');
    expect(queryAll('[role="treeitem"]').map(text)).toEqual(['Sales', 'Support', 'Inside Sales', 'Field Sales']);

    const input = query<HTMLInputElement>('input[etCascaderSearch]');

    expect(input.placeholder).toBe('Find a unit');

    input.value = 'f';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s, 300);
    http.expectNone((request) => request.url.endsWith('/units/search'));
    expect(text(query('.et-cascader-state--empty'))).toBe(DEFAULT_CASCADER_LABELS.noMatches);

    input.value = 'fie';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s, 100);
    input.value = 'field';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    settle(s, 150);

    http
      .expectOne((request) => param(request, 'q') === 'field')
      .flush({
        matches: [
          {
            path: [
              { id: 1, name: 'Sales' },
              { id: 12, name: 'Field Sales' },
            ],
            leaf: true,
          },
        ],
      });
    settle(s);
    http.verify();

    expect(queryAll('[role="option"]').map(text)).toEqual(['Sales / Field Sales']);

    s.keydown('Enter', input);
    settle(s);
    expect(app.model().unit).toBe(12);
    expect(text(query('.et-cascader-value', host))).toBe('Sales / Field Sales');
    s.frame(30);
  });
});
