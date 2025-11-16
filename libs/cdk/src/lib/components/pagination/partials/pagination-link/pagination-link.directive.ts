import { Directive, HostListener, input, output } from '@angular/core';
import { PaginationItem } from '../../types';

@Directive({
  selector: '[etPaginationLink]',
})
export class PaginationLinkDirective {
  readonly page = input.required<PaginationItem>({ alias: 'etPaginationLink' });

  readonly pageClick = output<PaginationItem>();

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    event.preventDefault();

    const page = this.page();
    if (page.disabled || page.current) {
      return;
    }

    this.pageClick.emit(page);
  }
}
