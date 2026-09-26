import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_PAGINATION_LABELS,
  injectPaginationLabels,
  PAGE_SIZE_SELECT_IMPORTS,
  PAGINATION_IMPORTS,
  PAGINATION_LABELS,
  paginate,
  PageSizeSelectComponent,
  PaginationComponent,
  PaginationDirective,
  PaginationSeoDirective,
  providePaginationLabels,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const UNSTYLED_BLOCKS = 'et-pagination { display: block; }';

const PLAYERS = Array.from({ length: 95 }, (_, index) => `Player ${index + 1}`);

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-roster',
  imports: [PAGINATION_IMPORTS, PAGE_SIZE_SELECT_IMPORTS],
  template: `
    <ul class="roster">
      @for (player of visible(); track $index) {
        <li>{{ player }}</li>
      }
    </ul>
    <et-page-size-select [pageSize]="pageSize()" [sizes]="[10, 25]" (pageSizeChange)="resize($event)" />
    <et-pagination
      [(page)]="page"
      [totalPages]="totalPages()"
      [totalItems]="players.length"
      [pageSize]="pageSize()"
      [responsive]="false"
      showJumpTo
    />
  `,
})
class RosterComponent {
  players = PLAYERS;
  page = signal(1);
  pageSize = signal(10);
  totalPages = computed(() => Math.ceil(this.players.length / this.pageSize()));
  visible = computed(() => this.players.slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize()));

  resize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-news-archive',
  imports: [PaginationComponent, PaginationSeoDirective],
  template: `
    <et-pagination
      [(page)]="page"
      [urlForPage]="urlFor"
      [etPaginationSeo]="urlFor"
      [pageTitle]="titleFor"
      [responsive]="false"
      renderAs="links"
      totalPages="4"
      hideFirstLast
    />
  `,
})
class NewsArchiveComponent {
  page = signal(2);
  urlFor = (page: number) => `https://example.com/news?page=${page}`;
  titleFor = (page: number) => `News - page ${page}`;
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-compact-footer',
  imports: [PaginationComponent, PageSizeSelectComponent],
  providers: [
    providePaginationLabels({
      navigation: 'Seitennavigation',
      previous: 'Vorherige Seite',
      compactPage: (page, total) => `Seite ${page} von ${total}`,
      pageSize: 'Pro Seite',
      pageSizeOption: (size) => `${size} Einträge`,
    }),
  ],
  template: `
    <et-page-size-select [(pageSize)]="pageSize" [labels]="{ pageSize: 'Zeilen' }" size="sm" />
    <et-pagination [(page)]="page" [compact]="true" [labels]="{ next: 'Weiter' }" totalPages="3" size="sm" />
    <p class="probe">{{ labels().first }}</p>
  `,
})
class CompactFooterComponent {
  page = signal(1);
  pageSize = signal(25);
  labels = injectPaginationLabels();
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-headless-pager',
  imports: [PaginationDirective],
  providers: [{ provide: PAGINATION_LABELS, useValue: { page: (page: number) => `Seite ${page}` } }],
  template: `
    <nav #pager="etPagination" [(page)]="page" etPagination totalPages="20" siblingCount="2" hidePreviousNext>
      @for (item of pager.items(); track $index) {
        @if (item.page !== null) {
          <button
            [attr.aria-current]="item.current ? 'page' : null"
            [attr.aria-label]="item.label"
            [disabled]="item.disabled"
            (click)="pager.goTo(item.page)"
            class="pager-item"
          >
            {{ item.type }}:{{ item.page }}
          </button>
        } @else {
          <span class="pager-gap">…</span>
        }
      }
      <button (click)="pager.next()" class="pager-next">next</button>
      <button (click)="pager.last()" class="pager-last">last</button>
      <button (click)="pager.previous()" class="pager-previous">previous</button>
      <button (click)="pager.first()" class="pager-first">first</button>
    </nav>
  `,
})
class HeadlessPagerComponent {
  page = signal(10);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('pagination scenarios', () => {
  const scenario = useScenario({ providers: [provideRouter([])] });

  it('pages a roster with buttons, the range readout, jump-to and the page size select', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const nav = query('[role="navigation"]', host);
    const controls = () => queryAll<HTMLButtonElement>('.et-pagination-button', host);
    const labels = () => controls().map((control) => control.getAttribute('aria-label'));
    const control = (label: string) => {
      const found = controls().find((candidate) => candidate.getAttribute('aria-label') === label);

      if (!found) throw new Error(`no ${label} in ${labels().join(', ')}`);

      return found;
    };

    expect(nav.getAttribute('aria-label')).toBe(DEFAULT_PAGINATION_LABELS.navigation);
    expect(labels()).toEqual([
      'First page',
      'Previous page',
      'Page 1',
      'Page 2',
      'Page 3',
      'Page 4',
      'Page 5',
      'Page 10',
      'Next page',
      'Last page',
    ]);
    expect(queryAll('.et-pagination-ellipsis', host)).toHaveLength(1);
    expect(control('Page 1').getAttribute('aria-current')).toBe('page');
    expect(control('Previous page').disabled).toBe(true);
    expect(text(query('.et-pagination-range .et-pagination-readout-text', host))).toBe('Showing 1–10 of 95');

    control('Next page').click();
    s.tick();
    expect(app.page()).toBe(2);
    expect(text(query('.roster li', host))).toBe('Player 11');

    control('Last page').click();
    s.tick();
    expect(app.page()).toBe(10);
    expect(text(query('.et-pagination-range .et-pagination-readout-text', host))).toBe('Showing 91–95 of 95');
    expect(control('Next page').disabled).toBe(true);
    expect(labels()).toContain('Page 6');

    const jump = query<HTMLInputElement>('.et-pagination-jump-input', host);

    expect(query('.et-pagination-jump-label', host).getAttribute('for')).toBe(jump.id);
    expect(text(query('.et-pagination-jump-label', host))).toBe('Go to page');
    expect(jump.max).toBe('10');
    jump.value = '42';
    s.keydown('Enter', jump);
    s.tick();
    expect(app.page()).toBe(10);
    expect(jump.value).toBe('');
    jump.value = '4';
    s.keydown('Enter', jump);
    s.tick();
    expect(app.page()).toBe(4);

    const sizeSelect = query<HTMLSelectElement>('.et-page-size-select-control', host);

    expect(text(query('.et-page-size-select-text', host))).toBe('Items per page');
    expect(Array.from(sizeSelect.options).map((option) => option.text)).toEqual(['10', '25']);
    sizeSelect.value = '25';
    sizeSelect.dispatchEvent(new Event('change'));
    s.tick();
    expect(app.pageSize()).toBe(25);
    expect(app.page()).toBe(1);
    expect(labels().filter((label) => label?.startsWith('Page '))).toEqual(['Page 1', 'Page 2', 'Page 3', 'Page 4']);
    expect(text(query('.et-pagination-range .et-pagination-readout-text', host))).toBe('Showing 1–25 of 95');
    s.flush();
  });

  it('renders crawlable links, intercepts plain clicks and writes the SEO head links and title', async () => {
    const s = scenario();
    const hadTitleElement = !!document.head.querySelector('title');

    await s.run(() => inject(Router)).navigateByUrl('/');
    const fixture = TestBed.createComponent(NewsArchiveComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const links = () => queryAll<HTMLAnchorElement>('a.et-pagination-button', host);
    const headLink = (rel: string) => document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.href ?? null;

    expect(links().map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com/news?page=1',
      'https://example.com/news?page=1',
      'https://example.com/news?page=2',
      'https://example.com/news?page=3',
      'https://example.com/news?page=4',
      'https://example.com/news?page=3',
    ]);
    expect(links()[2]?.getAttribute('aria-current')).toBe('page');
    expect(headLink('canonical')).toBe('https://example.com/news?page=2');
    expect(headLink('prev')).toBe('https://example.com/news?page=1');
    expect(headLink('next')).toBe('https://example.com/news?page=3');
    expect(document.title).toBe('News - page 2');

    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });

    links()[4]?.dispatchEvent(modified);
    s.tick();
    expect(modified.defaultPrevented).toBe(false);
    expect(app.page()).toBe(2);

    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });

    links()[4]?.dispatchEvent(plain);
    s.tick();
    expect(plain.defaultPrevented).toBe(true);
    expect(app.page()).toBe(4);
    expect(headLink('canonical')).toBe('https://example.com/news?page=4');
    expect(headLink('next')).toBeNull();
    expect(document.title).toBe('News - page 4');
    expect(queryAll('button.et-pagination-button', host).map((button) => button.getAttribute('data-type'))).toEqual([
      'next',
    ]);

    fixture.destroy();
    s.tick();
    expect(headLink('canonical')).toBeNull();
    expect(document.title).toBe('');

    if (!hadTitleElement) document.head.querySelector('title')?.remove();
    s.flush();
  });

  it('localizes a compact footer pager app-wide and per instance', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CompactFooterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const pagination = query('et-pagination', host);

    expect(pagination.hasAttribute('data-compact')).toBe(true);
    expect(pagination.getAttribute('data-size')).toBe('sm');
    expect(pagination.getAttribute('aria-label')).toBe('Seitennavigation');
    expect(text(query('.et-pagination-status .et-pagination-readout-text', host))).toBe('Seite 1 von 3');
    expect(
      queryAll('.et-pagination-button', host).map((button) => [
        button.getAttribute('aria-label'),
        button.hasAttribute('disabled'),
      ]),
    ).toEqual([
      ['Vorherige Seite', true],
      ['Weiter', false],
    ]);
    expect(text(query('.probe', host))).toBe('First page');

    query<HTMLButtonElement>('[aria-label="Weiter"]', host).click();
    s.tick();
    expect(app.page()).toBe(2);
    expect(text(query('.et-pagination-status .et-pagination-readout-text', host))).toBe('Seite 2 von 3');

    const select = query<HTMLSelectElement>('.et-page-size-select-control', host);

    expect(query('et-page-size-select', host).getAttribute('data-size')).toBe('sm');
    expect(text(query('.et-page-size-select-text', host))).toBe('Zeilen');
    expect(Array.from(select.options).map((option) => option.text)).toEqual([
      '10 Einträge',
      '25 Einträge',
      '50 Einträge',
      '100 Einträge',
    ]);
    expect(select.value).toBe('25');
    select.value = '100';
    select.dispatchEvent(new Event('change'));
    s.tick();
    expect(app.pageSize()).toBe(100);
    s.flush();
  });

  it('drives a headless pager from the directive and the paginate helper', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessPagerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const items = () => queryAll('.pager-item, .pager-gap', host).map(text);

    expect(query('nav', host).getAttribute('aria-label')).toBe('Pagination');
    expect(items()).toEqual([
      'first:1',
      'page:1',
      '…',
      'page:8',
      'page:9',
      'page:10',
      'page:11',
      'page:12',
      '…',
      'page:20',
      'last:20',
    ]);
    expect(query('[aria-current="page"]', host).getAttribute('aria-label')).toBe('Seite 10');

    query<HTMLButtonElement>('.pager-next', host).click();
    s.tick();
    expect(app.page()).toBe(11);
    query<HTMLButtonElement>('.pager-last', host).click();
    query<HTMLButtonElement>('.pager-next', host).click();
    s.tick();
    expect(app.page()).toBe(20);
    query<HTMLButtonElement>('.pager-first', host).click();
    query<HTMLButtonElement>('.pager-previous', host).click();
    s.tick();
    expect(app.page()).toBe(1);

    expect(
      paginate({ currentPage: 30, totalPages: 12, hideFirstLast: true, labels: { next: 'Weiter' } }).map((item) => [
        item.type,
        item.page,
        item.current,
        item.disabled,
        item.label,
      ]),
    ).toEqual([
      ['previous', 11, false, false, 'Previous page'],
      ['page', 1, false, false, 'Page 1'],
      ['ellipsis', null, false, true, 'More pages'],
      ['page', 8, false, false, 'Page 8'],
      ['page', 9, false, false, 'Page 9'],
      ['page', 10, false, false, 'Page 10'],
      ['page', 11, false, false, 'Page 11'],
      ['page', 12, true, false, 'Page 12'],
      ['next', 13, false, true, 'Weiter'],
    ]);
    expect(paginate({ currentPage: 1, totalPages: 0 })).toEqual([]);
  });
});
