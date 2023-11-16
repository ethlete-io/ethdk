import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { MenuComponent } from '../../components';
import { MenuTriggerDirective } from '../../directives';

@Component({
  selector: 'et-sb-menu',
  template: `
    <div class="row">
      <button etMenuTrigger>Menu</button>
      <button etMenuTrigger>Menu</button>
    </div>

    <div class="row">
      <button etMenuTrigger>Menu</button>
      <button etMenuTrigger>Menu</button>
    </div>

    <ng-template #menuTpl>
      <et-menu />
    </ng-template>
  `,
  styles: [
    `
      et-sb-menu {
        height: 120vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-bottom: 700px;
        .row {
          display: flex;
          justify-content: space-between;
        }
      }
    `,
  ],
  standalone: true,
  imports: [MenuTriggerDirective, OverlayModule, MenuComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuStorybookComponent {}
