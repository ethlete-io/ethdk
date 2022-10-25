import { NgModule } from '@angular/core';
import { ScrollableComponent } from './components';
import { CursorDragScrollDirective, ObserveScrollStateDirective } from './partials';

@NgModule({
  imports: [ScrollableComponent, ObserveScrollStateDirective, CursorDragScrollDirective],
  exports: [ScrollableComponent, ObserveScrollStateDirective, CursorDragScrollDirective],
})
export class ScrollableModule {}
