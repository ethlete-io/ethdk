import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, Injectable, ViewEncapsulation, inject } from '@angular/core';
import { MENU, MenuImports } from '../..';
import { CheckboxImports } from '../../../../../forms';

@Injectable()
export class TestService {}

@Component({
  selector: 'et-sb-menu-item',
  standalone: true,
  template: `<p>Menu</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MenuItemStorybookComponent {
  x = inject(MENU);
  testService = inject(TestService);
}

@Component({
  selector: 'et-sb-menu',
  template: `
    <div class="row">
      <button [etMenuTrigger]="menuTpl">Menu</button>
      <button [etMenuTrigger]="menuTpl">Menu</button>
      <button [etMenuTrigger]="menuTpl">Menu</button>
    </div>

    <div class="row">
      <button [etMenuTrigger]="menuTpl">Menu</button>
      <button [etMenuTrigger]="menuTpl">Menu</button>
      <button [etMenuTrigger]="menuTpl">Menu</button>
    </div>

    <ng-template #menuTpl>
      <et-menu>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>

        <div etMenuGroup>
          <span etMenuGroupTitle>Group Title</span>
          <p etMenuItem>Lorem, ipsum dolor.</p>
          <p etMenuItem>Lorem, ipsum dolor.</p>
          <p etMenuItem>Lorem, ipsum dolor.</p>
        </div>

        <!-- <div etMenuCheckboxGroup>
          <span etMenuGroupTitle>Checkbox group Title</span>
          <et-menu-checkbox-item etCheckboxGroupControl>All </et-menu-checkbox-item>
          <et-menu-checkbox-item>Checkbox item</et-menu-checkbox-item>
          <et-menu-checkbox-item>Checkbox item</et-menu-checkbox-item>
          <et-menu-checkbox-item>Checkbox item</et-menu-checkbox-item>
        </div>

        <div etMenuRadioGroup>
          <span etMenuGroupTitle>Radio group Title</span>
          <et-menu-radio-item value="1">Radio item</et-menu-radio-item>
          <et-menu-radio-item value="2">Radio item</et-menu-radio-item>
          <et-menu-radio-item value="3">Radio item</et-menu-radio-item>
        </div> -->
      </et-menu>
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
  imports: [OverlayModule, MenuItemStorybookComponent, CheckboxImports, MenuImports],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TestService],
})
export class MenuStorybookComponent {}
