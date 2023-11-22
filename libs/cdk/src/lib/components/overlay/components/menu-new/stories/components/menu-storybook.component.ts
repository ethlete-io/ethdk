import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { MENU, MenuComponent } from '../../components';
import { MenuItemDirective, MenuTriggerDirective } from '../../directives';

import { Injectable } from '@angular/core';

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
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>
        <p etMenuItem>Lorem, ipsum dolor.</p>

        <et-sb-menu-item etMenuItem />
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
  imports: [MenuTriggerDirective, OverlayModule, MenuComponent, MenuItemDirective, MenuItemStorybookComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TestService],
})
export class MenuStorybookComponent {}
