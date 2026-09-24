import { NgModule } from '@angular/core';
import { SuspenseMultiPipe } from './suspense-multi.pipe';
import { SuspensePipe } from './suspense.pipe';

/** Exports the `suspense` and `suspenseMulti` pipes, like the `NgRxToolkitModule` of `@tomtomb/ngrx-toolkit`. */
@NgModule({
  imports: [SuspensePipe, SuspenseMultiPipe],
  exports: [SuspensePipe, SuspenseMultiPipe],
})
export class NgRxToolkitModule {}
