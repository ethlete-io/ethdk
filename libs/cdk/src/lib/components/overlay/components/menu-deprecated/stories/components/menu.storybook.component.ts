import { Component } from '@angular/core';
import { CdkMenuModule } from '../../menu-module';

@Component({
  selector: 'et-sb-menu',
  template: `
    <button [cdkMenuTriggerFor]="cdkMenuTpl">Menu</button>

    <ng-template #cdkMenuTpl>
      <div class="my-menu" cdkMenu>
        @for (opt of options; track opt) {
          <button
            [cdkMenuItemChecked]="opt === activeOption"
            (cdkMenuItemTriggered)="activeOption = opt"
            type="button"
            cdkMenuItemRadio
          >
            Option {{ opt }}
          </button>
        }
      </div>
    </ng-template>

    <p>{{ activeOption }}</p>
  `,
  imports: [CdkMenuModule],
  styles: [
    `
      .my-menu {
        display: grid;
        max-height: 200px;
        overflow: auto;
        background-color: #fff;
        border: 1px solid #ccc;

        button {
          all: unset;
          border-radius: 0;
          width: 200px;
          padding: 0.5rem;
          color: #000;

          &:hover {
            background-color: #eee;
          }

          &[aria-checked='true'] {
            background-color: #ddd;
          }
        }
      }
    `,
  ],
})
export class MenuStorybookComponent {
  activeOption = 1;

  readonly options = Array.from({ length: 25 }, (_, i) => i + 1);
}
