import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'fk-root',
  template: `<router-outlet />`,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
})
export class Root {}
