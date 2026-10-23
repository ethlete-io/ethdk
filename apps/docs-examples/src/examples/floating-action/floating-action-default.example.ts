import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, FLOATING_ACTION_IMPORTS, FloatingActionDirective } from '@ethlete/components';

@Component({
  selector: 'app-floating-action-default-example',
  template: `
    <div #floatingAction="etFloatingAction" class="app-fa" etFloatingAction>
      <div class="app-fa-banner">
        <span class="app-fa-muted">State</span>
        <strong>{{ floatingAction.state() }}</strong>
        <span class="app-fa-muted">Scroll down</span>
      </div>

      <h2 class="app-fa-title" etFloatingActionTop>Results</h2>

      <div etFloatingActionAnchor>
        <button (click)="applyFilters(floatingAction)" et-button etFloatingActionTrigger>
          Filter ({{ applied() }})
        </button>
      </div>

      <ul class="app-fa-list" etFloatingActionScope>
        @for (row of rows; track row) {
          <li class="app-fa-row">
            <span class="app-fa-avatar"></span>
            <span class="app-fa-lines">
              <strong>Result {{ row }}</strong>
              <span class="app-fa-muted">Short description</span>
            </span>
          </li>
        }
      </ul>

      <div class="app-fa-footer">Footer - the Filter button is gone once the results scroll out of view</div>
    </div>
  `,
  styles: `
    .app-fa {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }

    .app-fa-banner {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 1rem 1.4rem;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 1rem;
      font-size: 1.4rem;
    }

    .app-fa-banner > :last-child {
      margin-inline-start: auto;
    }

    .app-fa-muted {
      color: var(--et-surface-color-muted-solid);
    }

    .app-fa-title {
      margin: 0;
      font-size: 2rem;
    }

    .app-fa-list {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .app-fa-row {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      padding: 1.2rem 1.4rem;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 1rem;
      font-size: 1.4rem;
    }

    .app-fa-avatar {
      flex: none;
      inline-size: 3.2rem;
      block-size: 3.2rem;
      border-radius: 50%;
      background-color: var(--et-surface-border-solid);
    }

    .app-fa-lines {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .app-fa-footer {
      box-sizing: border-box;
      min-block-size: 100vh;
      padding: 2.4rem 1.4rem;
      border: 1px dashed var(--et-surface-border-solid);
      border-radius: 1rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
      text-align: center;
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FLOATING_ACTION_IMPORTS, BUTTON_IMPORTS],
})
export class FloatingActionDefaultExampleComponent {
  protected readonly rows = Array.from({ length: 14 }, (_, index) => index + 1);

  protected applied = signal(0);

  protected applyFilters(floatingAction: FloatingActionDirective) {
    this.applied.update((count) => count + 1);
    floatingAction.scrollToTop();
  }
}
