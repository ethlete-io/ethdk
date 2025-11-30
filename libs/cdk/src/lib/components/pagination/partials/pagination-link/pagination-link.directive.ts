import { Directive, input, output } from '@angular/core';
import { applyHostListener } from '@ethlete/core';
import { PaginationItem } from '../../types';

@Directive({
  selector: '[etPaginationLink]',
})
export class PaginationLinkDirective {
  readonly page = input.required<PaginationItem>({ alias: 'etPaginationLink' });

  readonly pageClick = output<PaginationItem>();

  constructor() {
    applyHostListener('click', (event) => {
      event.preventDefault();

      const page = this.page();
      if (page.disabled || page.current) {
        return;
      }

      this.pageClick.emit(page);
    });
  }
}
