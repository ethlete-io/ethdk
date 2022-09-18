import { NgModule } from '@angular/core';
import { SortHeaderComponent } from './sort-header';
import { SortDirective } from './sort';
import { SORT_HEADER_INTL_PROVIDER } from './sort-header-intl';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule],
  exports: [SortDirective, SortHeaderComponent],
  declarations: [SortDirective, SortHeaderComponent],
  providers: [SORT_HEADER_INTL_PROVIDER],
})
export class SortModule {}
