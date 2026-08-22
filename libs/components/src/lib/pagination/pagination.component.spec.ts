import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { PaginationDirective } from './headless/pagination.directive';
import { PaginationRangeContext, providePaginationLabels } from './pagination-labels';
import { PaginationComponent } from './pagination.component';

@Component({
  selector: 'et-two-paginators-test',
  imports: [PaginationComponent],
  template: `
    <et-pagination [totalPages]="5" [page]="1" showJumpTo />
    <et-pagination [totalPages]="5" [page]="1" showJumpTo />
  `,
})
class TwoPaginatorsComponent {}

const create = (): ComponentFixture<PaginationComponent> => {
  const fixture = TestBed.createComponent(PaginationComponent);
  fixture.componentRef.setInput('totalPages', 5);
  fixture.componentRef.setInput('page', 1);
  fixture.detectChanges();

  return fixture;
};

const directiveOf = (fixture: ComponentFixture<PaginationComponent>) =>
  fixture.debugElement.injector.get(PaginationDirective);

describe('PaginationComponent', () => {
  it('renders a navigation landmark with a button per page plus jump controls', () => {
    const fixture = create();
    const nav = fixture.nativeElement as HTMLElement;

    expect(nav.getAttribute('role')).toBe('navigation');
    // first, previous, 1..5, next, last
    expect(nav.querySelectorAll('.et-pagination-button').length).toBe(9);
    expect(nav.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');
  });

  it('goes to a page (clamped) via the headless directive, driving the two-way page', () => {
    const fixture = create();
    const pagination = directiveOf(fixture);

    pagination.goTo(3);
    expect(pagination.page()).toBe(3);

    pagination.goTo(99);
    expect(pagination.page()).toBe(5); // clamped to totalPages

    pagination.goTo(-1);
    expect(pagination.page()).toBe(1);
  });

  it('renders ellipsis gaps for large page counts', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 50);
    fixture.componentRef.setInput('page', 25);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-pagination-ellipsis').length).toBe(2);
  });

  it('shows a "Showing X–Y of Z" readout when totalItems and pageSize are set', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 25);
    fixture.componentRef.setInput('page', 3);
    fixture.componentRef.setInput('totalItems', 500);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.detectChanges();

    // The live text, not the range box: that also holds an invisible width-reserving copy of the
    // widest readout (see `widestRangeStatus`).
    const readout = (fixture.nativeElement as HTMLElement).querySelector('.et-pagination-range');
    expect(readout?.querySelector('.et-pagination-readout-text')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Showing 41–60 of 500',
    );
    expect(readout?.querySelector('.et-pagination-readout-sizer')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Showing 500–500 of 500',
    );
  });

  it('clamps the readout end to the total on the last, partial page', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('page', 3);
    fixture.componentRef.setInput('totalItems', 45);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.detectChanges();

    expect(fixture.componentInstance.range()).toEqual([41, 45]);
  });

  it('omits the readout when totalItems or pageSize is missing', () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('.et-pagination-range')).toBeNull();
  });

  it('renders crawlable anchors with hrefs in links mode', () => {
    const fixture = create();
    fixture.componentRef.setInput('renderAs', 'links');
    fixture.componentRef.setInput('urlForPage', (page: number) => `/list?page=${page}`);
    fixture.detectChanges();

    const anchors = (fixture.nativeElement as HTMLElement).querySelectorAll('a.et-pagination-button');
    expect(anchors.length).toBeGreaterThan(0);
    const pageThree = [...anchors].find((a) => a.textContent?.trim() === '3');
    expect(pageThree?.getAttribute('href')).toBe('/list?page=3');
  });

  it('intercepts a plain click on a link item (no navigation) and drives the page model', () => {
    const fixture = create();
    fixture.componentRef.setInput('renderAs', 'links');
    fixture.componentRef.setInput('urlForPage', (page: number) => `/list?page=${page}`);
    fixture.detectChanges();

    const pagination = directiveOf(fixture);
    const pageThree = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a.et-pagination-button')].find(
      (a) => a.textContent?.trim() === '3',
    ) as HTMLAnchorElement;

    const event = new MouseEvent('click', { cancelable: true, button: 0 });
    pageThree.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(pagination.page()).toBe(3);
  });

  it('lets modifier clicks fall through to the browser in links mode', () => {
    const fixture = create();
    fixture.componentRef.setInput('renderAs', 'links');
    fixture.componentRef.setInput('urlForPage', (page: number) => `/list?page=${page}`);
    fixture.detectChanges();

    const pagination = directiveOf(fixture);
    const pageThree = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a.et-pagination-button')].find(
      (a) => a.textContent?.trim() === '3',
    ) as HTMLAnchorElement;

    const event = new MouseEvent('click', { cancelable: true, button: 0, metaKey: true });
    pageThree.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(false);
    expect(pagination.page()).toBe(1);
  });

  it('localizes every built-in string via providePaginationLabels', () => {
    TestBed.configureTestingModule({
      providers: [
        providePaginationLabels({
          navigation: 'Seitennavigation',
          previous: 'Vorherige Seite',
          page: (page) => `Seite ${page}`,
          range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
          jumpTo: 'Gehe zu Seite',
        }),
      ],
    });

    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 25);
    fixture.componentRef.setInput('page', 3);
    fixture.componentRef.setInput('totalItems', 500);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('showJumpTo', true);
    fixture.detectChanges();

    const nav = fixture.nativeElement as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Seitennavigation');
    expect(nav.querySelector('.et-pagination-button[data-type="previous"]')?.getAttribute('aria-label')).toBe(
      'Vorherige Seite',
    );
    expect(nav.querySelector('[aria-current="page"]')?.getAttribute('aria-label')).toBe('Seite 3');
    expect(nav.querySelector('.et-pagination-range .et-pagination-readout-text')?.textContent?.trim()).toBe(
      'Zeige 41–60 von 500',
    );
    expect(nav.querySelector('.et-pagination-jump-label')?.textContent?.trim()).toBe('Gehe zu Seite');
    // untranslated keys keep their English default
    expect(nav.querySelector('.et-pagination-button[data-type="next"]')?.getAttribute('aria-label')).toBe('Next page');
  });

  it('lets a `labels` input override the provided set for one instance', () => {
    TestBed.configureTestingModule({ providers: [providePaginationLabels({ next: 'Vorwärts' })] });

    const fixture = create();
    fixture.componentRef.setInput('labels', { next: 'Weiter' });
    fixture.detectChanges();

    const nav = fixture.nativeElement as HTMLElement;

    expect(nav.querySelector('.et-pagination-button[data-type="next"]')?.getAttribute('aria-label')).toBe('Weiter');
    expect(nav.querySelector('.et-pagination-button[data-type="previous"]')?.getAttribute('aria-label')).toBe(
      'Previous page',
    );
  });

  it('localizes the compact pager readout', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 4);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('totalItems', 40);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('labels', {
      compactRange: ({ start, end, totalItems }: PaginationRangeContext) => `${start}–${end} von ${totalItems}`,
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('.et-pagination-status .et-pagination-readout-text')
        ?.textContent?.trim(),
    ).toBe('1–10 von 40');
  });

  it('omits the compact pager controls when hidePreviousNext is set', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('totalPages', 5);
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('hidePreviousNext', true);
    fixture.detectChanges();

    const nav = fixture.nativeElement as HTMLElement;

    expect(nav.querySelectorAll('[data-type="previous"]').length).toBe(0);
    expect(nav.querySelectorAll('[data-type="next"]').length).toBe(0);
    expect(nav.querySelector('.et-pagination-status .et-pagination-readout-text')?.textContent?.trim()).toBe('2 / 5');
  });

  it('gives each paginator its own jump input id, so two on a page stay independently labelled', () => {
    const fixture = TestBed.createComponent(TwoPaginatorsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const hosts = [...root.querySelectorAll('et-pagination')];
    const ids = hosts.map((host) => host.querySelector('.et-pagination-jump-input')?.id);

    expect(ids.filter(Boolean).length).toBe(2);
    expect(new Set(ids).size).toBe(2);

    hosts.forEach((host, index) => {
      expect(host.querySelector('.et-pagination-jump-label')?.getAttribute('for')).toBe(ids[index]);
      expect(root.querySelectorAll(`[id="${ids[index]}"]`).length).toBe(1);
    });
  });

  it('keeps an explicit ariaLabel ahead of the label set (multiple paginators on a page)', () => {
    const fixture = create();
    fixture.componentRef.setInput('ariaLabel', 'Search results pages');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toBe('Search results pages');
  });
});
