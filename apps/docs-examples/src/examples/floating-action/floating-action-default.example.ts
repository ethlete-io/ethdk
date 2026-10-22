import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, FLOATING_ACTION_IMPORTS, FloatingActionDirective } from '@ethlete/components';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod nisl nec ultricies. Aenean vulputate ' +
  'eleifend tellus. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus maecenas tempus.';

@Component({
  selector: 'app-floating-action-default-example',
  template: `
    <div #floatingAction="etFloatingAction" etFloatingAction>
      <p>
        State: <strong>{{ floatingAction.state() }}</strong> - scroll down and the Filter button pins itself to the
        corner; scroll past the results and it goes away again.
      </p>

      @for (paragraph of intro; track $index) {
        <p>{{ paragraph }}</p>
      }

      <h2 etFloatingActionTop>Results</h2>

      <div etFloatingActionAnchor>
        <button (click)="applyFilters(floatingAction)" et-button etFloatingActionTrigger>
          Filter ({{ applied() }})
        </button>
      </div>

      <ul etFloatingActionScope>
        @for (row of rows; track row) {
          <li>Result {{ row }}</li>
        }
      </ul>

      @for (paragraph of outro; track $index) {
        <p>{{ paragraph }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FLOATING_ACTION_IMPORTS, BUTTON_IMPORTS],
})
export class FloatingActionDefaultExampleComponent {
  protected readonly rows = Array.from({ length: 24 }, (_, index) => index + 1);
  protected readonly intro = Array.from({ length: 4 }, () => LOREM);
  protected readonly outro = Array.from({ length: 14 }, () => LOREM);

  protected applied = signal(0);

  protected applyFilters(floatingAction: FloatingActionDirective) {
    this.applied.update((count) => count + 1);
    floatingAction.scrollToTop();
  }
}
