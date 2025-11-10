import { Directive, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { PaginationItem } from '../../types';

@Directive({
  selector: '[etPaginationLink]',
})
export class PaginationLinkDirective {
  @Input('etPaginationLink')
  page!: PaginationItem;

  @Output()
  pageClick = new EventEmitter<PaginationItem>();

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    event.preventDefault();

    if (this.page.disabled || this.page.current) {
      return;
    }

    this.pageClick.emit(this.page);
  }
}
