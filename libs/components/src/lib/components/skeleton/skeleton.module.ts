import { NgModule } from '@angular/core';
import { SkeletonComponent } from './components';
import { SkeletonItemComponent } from './partials';

@NgModule({
  imports: [SkeletonComponent, SkeletonItemComponent],
  exports: [SkeletonComponent, SkeletonItemComponent],
})
export class SkeletonModule {}
