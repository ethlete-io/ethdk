import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationDirective } from './headless/pagination.directive';
import { PaginationComponent } from './pagination.component';

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

    const readout = (fixture.nativeElement as HTMLElement).querySelector('.et-pagination-range');
    expect(readout?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Showing 41–60 of 500');
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
});
