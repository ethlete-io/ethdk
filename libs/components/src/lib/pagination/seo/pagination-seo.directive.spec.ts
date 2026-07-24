import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PaginationDirective } from '../headless/pagination.directive';
import { PaginationSeoDirective } from './pagination-seo.directive';

@Component({
  template: `<nav [etPagination] [page]="page()" [totalPages]="4" [etPaginationSeo]="urlForPage"></nav>`,
  imports: [PaginationDirective, PaginationSeoDirective],
})
class HostComponent {
  public page = signal(2);
  public urlForPage = (page: number) => `https://example.com/list?page=${page}`;
}

const canonicalHref = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
const relHref = (rel: string) => document.head.querySelector(`link[rel="${rel}"]`)?.getAttribute('href') ?? null;

describe('PaginationSeoDirective', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('link[rel="canonical"], link[rel="prev"], link[rel="next"]')
      .forEach((el) => el.remove());
  });

  it('keeps a canonical link pointing at the current page and updates it reactively', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(canonicalHref()).toBe('https://example.com/list?page=2');

    fixture.componentInstance.page.set(3);
    fixture.detectChanges();

    expect(canonicalHref()).toBe('https://example.com/list?page=3');
  });

  it('emits prev/next rel links, dropping prev on the first page and next on the last', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.page.set(1);
    fixture.detectChanges();

    expect(relHref('prev')).toBeNull();
    expect(relHref('next')).toBe('https://example.com/list?page=2');

    fixture.componentInstance.page.set(4);
    fixture.detectChanges();

    expect(relHref('prev')).toBe('https://example.com/list?page=3');
    expect(relHref('next')).toBeNull();
  });
});
