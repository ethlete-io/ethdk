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
});
