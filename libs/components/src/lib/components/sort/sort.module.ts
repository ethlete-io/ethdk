import { NgModule } from '@angular/core';
import { SORT_HEADER_INTL_PROVIDER } from './services';
import { SortHeaderComponent } from './components';
import { SortDirective } from './partials';

@NgModule({
  imports: [SortDirective, SortHeaderComponent],
  exports: [SortDirective, SortHeaderComponent],
  providers: [SORT_HEADER_INTL_PROVIDER],
})
export class SortModule {}
