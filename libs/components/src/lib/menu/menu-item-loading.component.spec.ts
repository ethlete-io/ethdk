import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemes } from '@ethlete/core';
import '../../test-helpers';
import { TEST_COLOR_THEMES } from '../testing/color-themes';
import { MenuDirective } from './headless';
import { MENU_IMPORTS } from './menu.imports';

@Component({
  template: `
    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">Actions</button>

      <ng-template etMenuSurface>
        <et-menu>
          <button class="first" et-menu-item type="button">Rename</button>
          <button
            [loading]="exporting()"
            (click)="clicks.set(clicks() + 1)"
            (activate)="activations.set(activations() + 1)"
            class="export"
            et-menu-item
            type="button"
          >
            Export
          </button>
          <button class="last" et-menu-item type="button">Delete</button>
          <et-menu-checkbox-item [loading]="exporting()" (activate)="activations.set(activations() + 1)" class="check">
            Sync
          </et-menu-checkbox-item>
        </et-menu>
      </ng-template>
    </div>
  `,
  imports: [...MENU_IMPORTS],
})
class MenuItemLoadingTestHost {
  public exporting = signal(true);
  public clicks = signal(0);
  public activations = signal(0);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const keydown = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('Menu item loading state', () => {
  let fixture: ComponentFixture<MenuItemLoadingTestHost>;
  let menu: MenuDirective;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const query = <T extends HTMLElement>(selector: string) => {
    const element = document.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Expected element for selector "${selector}"`);
    }

    return element;
  };

  const openMenu = async () => {
    query('.root-trigger').click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MenuItemLoadingTestHost],
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });

    fixture = TestBed.createComponent(MenuItemLoadingTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('marks a loading item busy and renders a spinner', async () => {
    await openMenu();

    const item = query('.export');

    expect(item.getAttribute('aria-busy')).toBe('true');
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(item.getAttribute('data-loading')).toBe('true');
    expect(item.querySelector('.et-menu-item-loader et-spinner')).not.toBeNull();
    expect(query('.check').querySelector('.et-menu-item-check et-spinner')).not.toBeNull();
  });

  it('renders no spinner and no busy state by default', async () => {
    fixture.componentInstance.exporting.set(false);
    await openMenu();

    const item = query('.export');

    expect(item.getAttribute('aria-busy')).toBeNull();
    expect(item.getAttribute('aria-disabled')).toBeNull();
    expect(item.querySelector('et-spinner')).toBeNull();
  });

  it('blocks pointer activation and keeps the menu open', async () => {
    await openMenu();

    query('.export').click();
    query('.check').click();
    tick();

    expect(fixture.componentInstance.clicks()).toBe(0);
    expect(fixture.componentInstance.activations()).toBe(0);
    expect(menu.open()).toBe(true);
  });

  it('blocks keyboard activation but stays reachable with the arrow keys', async () => {
    await openMenu();

    const first = query('.first');

    first.focus();
    keydown(first, 'ArrowDown');
    tick();

    const item = query('.export');

    expect(document.activeElement).toBe(item);

    keydown(item, 'Enter');
    keydown(item, ' ');
    tick();

    expect(fixture.componentInstance.clicks()).toBe(0);
    expect(fixture.componentInstance.activations()).toBe(0);
    expect(menu.open()).toBe(true);
  });

  it('activates again once loading ends', async () => {
    await openMenu();

    fixture.componentInstance.exporting.set(false);
    tick();
    query('.export').click();
    tick();

    expect(fixture.componentInstance.clicks()).toBe(1);
    expect(fixture.componentInstance.activations()).toBe(1);
  });
});
