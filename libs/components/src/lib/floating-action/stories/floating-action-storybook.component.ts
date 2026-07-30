import { Component, ViewEncapsulation, input, signal, viewChild } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { FloatingActionDirective } from '../headless';
import { FLOATING_ACTION_IMPORTS } from '../floating-action.imports';

@Component({
  selector: 'et-sb-floating-action',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium font-sans">
      <div #floatingAction="etFloatingAction" [disabled]="disabled()" class="flex flex-col gap-6 p-8" etFloatingAction>
        <p class="text-small opacity-60">
          State: <strong>{{ floatingAction.state() }}</strong> — scroll down and the Filter button pins itself to the
          corner; scroll past the results and it goes away again.
        </p>

        @for (paragraph of INTRO; track $index) {
          <p [style.max-inline-size.px]="640" class="m-0">{{ paragraph }}</p>
        }

        <h2 class="text-h6 m-0" etFloatingActionTop>Results</h2>

        <!-- The anchor keeps the button's space in the flow. It has to be a separate element from the button:
             once the button is fixed it is always on screen, so observing it would oscillate. -->
        <div etFloatingActionAnchor>
          <button (click)="applyFilters(floatingAction)" et-button etFloatingActionTrigger>
            Filter ({{ applied() }})
          </button>
        </div>

        <ul [style.max-inline-size.px]="640" class="m-0 flex flex-col gap-2 p-0" etFloatingActionScope>
          @for (row of ROWS; track row) {
            <li class="list-none rounded-md p-3" style="background: var(--et-surface-background-solid)">
              Result {{ row }}
            </li>
          }
        </ul>

        @for (paragraph of OUTRO; track $index) {
          <p [style.max-inline-size.px]="640" class="m-0">{{ paragraph }}</p>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FLOATING_ACTION_IMPORTS, BUTTON_IMPORTS, ProvideSurfaceDirective],
})
export class FloatingActionStorybookComponent {
  public surface = input('dark');
  public disabled = input(false);

  public floatingAction = viewChild(FloatingActionDirective);

  protected readonly ROWS = Array.from({ length: 24 }, (_, index) => index + 1);
  protected readonly INTRO = Array.from({ length: 4 }, () => LOREM);

  /**
   * Long enough that the results list can scroll *fully* past the viewport — otherwise the `hidden` state is
   * unreachable and the story silently only demonstrates two of the three.
   */
  protected readonly OUTRO = Array.from({ length: 14 }, () => LOREM);

  protected applied = signal(0);

  /** What a filter button does: apply, then send the reader back to the first result. */
  protected applyFilters(floatingAction: FloatingActionDirective) {
    this.applied.update((count) => count + 1);
    floatingAction.scrollToTop();
  }
}

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod nisl nec ultricies. Aenean vulputate ' +
  'eleifend tellus. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus maecenas tempus.';
