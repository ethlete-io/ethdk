import { Component, ViewEncapsulation, input } from '@angular/core';
import { ScrollbarComponent } from '../scrollbar';

@Component({
  selector: 'et-menu-scrollbar',
  template: `<et-scrollbar [for]="target()" autoHide />`,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollbarComponent],
})
export class MenuScrollbarComponent {
  public target = input.required<HTMLElement>();
}
