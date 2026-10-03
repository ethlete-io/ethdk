import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  MENU_ERROR_CODES,
  MENU_ITEM_VARIANTS,
  MenuComponent,
  MenuContextTriggerDirective,
  MenuDirective,
  MenuItemComponent,
  MenuItemDirective,
  MenuItemShortcutComponent,
  MenuItemSubmenuIconComponent,
  MenuPanelDirective,
  MenuSeparatorComponent,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const code = (value: number) => `ET${value}`;

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const focused = () => text(document.activeElement);

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const takeErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  return s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;
};

@Component({
  selector: 'et-scenario-file-menu',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    MenuItemShortcutComponent,
    MenuSeparatorComponent,
  ],
  template: `
    <div #menu="etMenu" [(open)]="open" [loop]="loop()" [disabled]="disabled()" etMenu>
      <button class="trigger" etMenuTrigger type="button">File</button>

      <ng-template etMenuSurface>
        <et-menu>
          <button (click)="log.push('new')" (activate)="sources.push($event.source)" et-menu-item type="button">
            New file
            <et-menu-item-shortcut>Ctrl N</et-menu-item-shortcut>
          </button>
          <button (click)="log.push('save')" et-menu-item type="button">Save</button>
          <button disabled et-menu-item type="button">Publish</button>
          <et-menu-separator />
          <div etMenu>
            <button class="export" et-menu-item etMenuTrigger type="button">Export as</button>
            <ng-template etMenuSurface>
              <et-menu>
                <button (click)="log.push('pdf')" et-menu-item type="button">PDF</button>
                <button (click)="log.push('csv')" et-menu-item type="button">CSV</button>
              </et-menu>
            </ng-template>
          </div>
          <et-menu-separator />
          <button [variant]="deleteVariant" (click)="log.push('delete')" class="delete" et-menu-item type="button">
            Delete team-a
          </button>
        </et-menu>
      </ng-template>
    </div>
  `,
})
class FileMenuComponent {
  open = signal(false);
  loop = signal(true);
  disabled = signal(false);
  deleteVariant = MENU_ITEM_VARIANTS.DESTRUCTIVE;
  log: string[] = [];
  sources: string[] = [];
}

@Component({
  selector: 'et-scenario-board-menu',
  imports: [MenuDirective, MenuContextTriggerDirective, MenuSurfaceDirective, MenuPanelDirective, MenuItemDirective],
  template: `
    <div #menu="etMenu" etMenu>
      <section class="board" etMenuContextTrigger>Team A board</section>
      <ng-template etMenuSurface let-close="close">
        <div class="board-panel" etMenuPanel>
          <button (activate)="log.push('rename')" class="rename" etMenuItem type="button">Rename</button>
          <button (click)="close()" class="dismiss" etMenuItem type="button">Dismiss</button>
        </div>
      </ng-template>
    </div>
  `,
})
class BoardMenuComponent {
  log: string[] = [];
}

@Component({
  selector: 'et-scenario-stray-menu-parts',
  imports: [MenuDirective, MenuTriggerDirective, MenuItemDirective, MenuContextTriggerDirective, MenuSurfaceDirective],
  template: `
    <button class="stray-trigger" etMenuTrigger type="button">Stray</button>
    <button class="stray-item" etMenuItem type="button">Stray</button>
    <div class="no-surface" etMenu></div>
    <div etMenu>
      <button etMenuTrigger type="button">Root</button>
      <ng-template etMenuSurface>root</ng-template>
      <div class="nested" etMenu>
        <span class="nested-zone" etMenuContextTrigger>zone</span>
        <ng-template etMenuSurface>nested</ng-template>
      </div>
    </div>
  `,
})
class StrayMenuPartsComponent {}

const openFileMenu = (s: Scenario) => {
  const fixture = TestBed.createComponent(FileMenuComponent);

  s.tick();
  query('.trigger').focus();
  query('.trigger').click();
  settle(s);

  return fixture;
};

describe('menu scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('opens a file menu from its trigger, wires the menu roles and focuses the first item', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FileMenuComponent);
    const trigger = query('.trigger');

    s.tick();

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBeNull();

    trigger.focus();
    trigger.click();
    settle(s);

    const panel = query('et-menu');

    expect(fixture.componentInstance.open()).toBe(true);
    expect(document.querySelector('.et-menu-overlay-pane')?.contains(panel)).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.hasAttribute('data-menu-open')).toBe(true);
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('role')).toBe('menu');
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);

    const items = Array.from(panel.querySelectorAll<HTMLElement>('[et-menu-item]'));

    expect(items.map((item) => item.getAttribute('role'))).toEqual(Array(5).fill('menuitem'));
    expect(items.map((item) => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
    expect(items[2]?.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(items[0]);
    expect(items[0]?.hasAttribute('data-active')).toBe(true);
    expect(panel.querySelector('et-menu-item-shortcut')?.getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(panel.querySelectorAll('et-menu-separator')).map((sep) => sep.getAttribute('role'))).toEqual([
      'separator',
      'separator',
    ]);
    expect(query('.delete').getAttribute('data-variant')).toBe('destructive');
    expect(query('.delete').classList).toContain('et-color--alert');
    expect(query('.export').querySelector('et-menu-item-submenu-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(getDebugNode(query('et-menu-item-submenu-icon'))?.componentInstance).toBeInstanceOf(
      MenuItemSubmenuIconComponent,
    );
    expect(document.querySelector('.et-overlay-arrow')).not.toBeNull();

    trigger.click();
    settle(s);

    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.querySelector('et-menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('navigates with arrows, Home, End and typeahead, skipping disabled items and wrapping', () => {
    const s = scenario();
    const fixture = openFileMenu(s);

    s.keydown('ArrowDown');
    expect(focused()).toBe('Save');

    s.keydown('ArrowDown');
    expect(focused()).toBe('Export as');

    s.keydown('End');
    expect(focused()).toBe('Delete team-a');

    s.keydown('ArrowDown');
    expect(focused()).toContain('New file');

    s.keydown('ArrowUp');
    expect(focused()).toBe('Delete team-a');

    s.keydown('Home');
    expect(focused()).toContain('New file');

    s.keydown('e');
    expect(focused()).toBe('Export as');

    s.tick(1000);
    s.keydown('s');
    expect(focused()).toBe('Save');
    s.tick(1000);

    fixture.componentInstance.loop.set(false);
    s.keydown('Home');
    s.keydown('ArrowUp');
    expect(focused()).toContain('New file');

    fixture.destroy();
    settle(s);
    expect(document.querySelector('.et-menu-overlay-pane')).toBeNull();
  });

  it('activates items by keyboard and pointer, closes the tree and returns focus to the trigger', () => {
    const s = scenario();
    const fixture = openFileMenu(s);
    const page = fixture.componentInstance;

    s.keydown('Enter');
    settle(s);

    expect(page.log).toEqual(['new']);
    expect(page.sources).toEqual(['keyboard-enter']);
    expect(page.open()).toBe(false);
    expect(document.activeElement).toBe(query('.trigger'));

    s.keydown('ArrowUp', query('.trigger'));
    settle(s);
    expect(focused()).toBe('Delete team-a');

    s.keydown(' ');
    settle(s);
    expect(page.log).toEqual(['new', 'delete']);
    expect(page.open()).toBe(false);

    s.keydown('ArrowDown', query('.trigger'));
    settle(s);
    query<HTMLButtonElement>('et-menu [et-menu-item]:nth-of-type(2)').click();
    settle(s);
    expect(page.log).toEqual(['new', 'delete', 'save']);
    expect(page.open()).toBe(false);
  });

  it('opens a submenu with ArrowRight or Enter, walks back with ArrowLeft and closes all from a sub item', () => {
    const s = scenario();
    const fixture = openFileMenu(s);
    const page = fixture.componentInstance;
    const exportItem = query('.export');

    expect(exportItem.getAttribute('aria-haspopup')).toBe('menu');

    s.keydown('End');
    s.keydown('ArrowUp');
    expect(document.activeElement).toBe(exportItem);

    s.keydown('ArrowRight');
    settle(s);

    expect(document.querySelectorAll('et-menu')).toHaveLength(2);
    expect(exportItem.getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe('PDF');

    s.keydown('ArrowDown');
    expect(focused()).toBe('CSV');

    s.keydown('ArrowLeft');
    settle(s);

    expect(document.querySelectorAll('et-menu')).toHaveLength(1);
    expect(document.activeElement).toBe(exportItem);

    s.keydown('Enter');
    settle(s);
    expect(focused()).toBe('PDF');

    s.keydown('Escape');
    settle(s);
    expect(document.activeElement).toBe(exportItem);
    expect(page.open()).toBe(true);

    s.keydown('ArrowRight');
    settle(s);
    s.keydown('Enter');
    settle(s);

    expect(page.log).toEqual(['pdf']);
    expect(page.open()).toBe(false);
    expect(document.querySelector('et-menu')).toBeNull();
    expect(document.activeElement).toBe(query('.trigger'));
  });

  it('opens a submenu on hover after the delay and closes it when the pointer moves on', () => {
    const s = scenario();
    const menu = openFileMenu(s);

    const hover = (element: Element) => {
      element.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse' }));
      s.tick();
    };

    hover(query('.export'));
    s.tick(100);
    expect(document.querySelectorAll('et-menu')).toHaveLength(1);

    s.tick(20);
    settle(s);
    expect(document.querySelectorAll('et-menu')).toHaveLength(2);
    expect(document.activeElement).toBe(query('.export'));

    hover(query('.delete'));
    s.tick(299);
    expect(document.querySelectorAll('et-menu')).toHaveLength(2);

    s.tick(1);
    settle(s);
    expect(document.querySelectorAll('et-menu')).toHaveLength(1);

    menu.destroy();
    settle(s);
    expect(document.querySelector('.et-menu-overlay-pane')).toBeNull();
  });

  it('closes on Escape, Tab, an outside press, and stays shut while disabled', () => {
    const s = scenario();
    const fixture = openFileMenu(s);
    const page = fixture.componentInstance;

    s.keydown('Escape');
    settle(s);
    expect(page.open()).toBe(false);
    expect(document.activeElement).toBe(query('.trigger'));

    s.keydown('Enter', query('.trigger'));
    settle(s);
    expect(page.open()).toBe(true);

    s.keydown('Tab');
    settle(s);
    expect(page.open()).toBe(false);

    page.open.set(true);
    settle(s);
    expect(document.querySelector('et-menu')).not.toBeNull();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    settle(s);
    expect(page.open()).toBe(false);

    page.disabled.set(true);
    s.tick();
    query('.trigger').click();
    settle(s);
    expect(page.open()).toBe(false);
    expect(document.querySelector('et-menu')).toBeNull();
  });

  it('opens a context menu at the pointer on a headless panel and closes it from the surface context', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BoardMenuComponent);
    const board = query('.board');

    s.tick();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });

    board.dispatchEvent(event);
    settle(s);

    expect(event.defaultPrevented).toBe(true);
    expect(board.hasAttribute('data-menu-open')).toBe(true);

    const panel = query('.board-panel');

    expect(panel.getAttribute('role')).toBe('menu');
    expect(panel.getAttribute('tabindex')).toBe('-1');
    expect(panel.getAttribute('aria-labelledby')).toBeNull();
    expect(document.querySelector('.et-overlay-arrow')).toBeNull();
    expect(document.activeElement).toBe(query('.rename'));

    s.keydown('Enter');
    settle(s);
    expect(fixture.componentInstance.log).toEqual(['rename']);
    expect(document.querySelector('.board-panel')).toBeNull();
    expect(board.hasAttribute('data-menu-open')).toBe(false);

    board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    settle(s);
    query('.dismiss').click();
    settle(s);
    expect(document.querySelector('.board-panel')).toBeNull();
    expect(fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective).open()).toBe(false);
  });

  it('reports menu parts used outside a menu', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StrayMenuPartsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    s.expectError(code(MENU_ERROR_CODES.TRIGGER_OUTSIDE_MENU));
    s.expectError(code(MENU_ERROR_CODES.ITEM_OUTSIDE_MENU));
    s.expectError(code(MENU_ERROR_CODES.MISSING_MENU_SURFACE));
    s.expectError(code(MENU_ERROR_CODES.CONTEXT_TRIGGER_ON_SUBMENU));

    const elements = [takeErrorContext(s), takeErrorContext(s), takeErrorContext(s), takeErrorContext(s)].map(
      (context) => context?.element,
    );

    expect(elements).toEqual(
      expect.arrayContaining([
        host.querySelector('.stray-trigger'),
        host.querySelector('.stray-item'),
        host.querySelector('.no-surface'),
        host.querySelector('.nested-zone'),
      ]),
    );
  });

  it('leaves no pending frame when the page is destroyed with the menu open', () => {
    const s = scenario();
    const fixture = openFileMenu(s);

    expect(document.querySelector('.et-menu-overlay-pane')).not.toBeNull();

    fixture.destroy();
  });
});
