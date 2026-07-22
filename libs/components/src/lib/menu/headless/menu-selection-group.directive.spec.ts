import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSelectionGroupDirective } from './menu-selection-group.directive';
import { MenuSelectionItemDirective } from './menu-selection-item.directive';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `
    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">Open menu</button>

      <ng-template etMenuSurface>
        <div class="root-panel" etMenuPanel>
          <button class="action" etMenuItem type="button">Refresh</button>

          <div [(value)]="sortBy" class="radio-group" etMenuSelectionGroup>
            <button class="radio-name" etMenuItem etMenuSelectionItem value="name" type="button">Name</button>
            <button class="radio-date" etMenuItem etMenuSelectionItem value="date" type="button">Date</button>
          </div>

          <div [(value)]="columns" class="check-group" multiple etMenuSelectionGroup>
            <button class="check-size" etMenuItem etMenuSelectionItem value="size" type="button">Size</button>
            <button class="check-kind" etMenuItem etMenuSelectionItem value="kind" type="button">Kind</button>
          </div>

          <button [(checked)]="standaloneChecked" class="standalone" etMenuItem etMenuSelectionItem type="button">
            Show hidden files
          </button>

          <div [(value)]="assigned" class="loop-group" etMenuSelectionGroup>
            @for (label of loopLabels; track label) {
              <button
                [value]="label"
                [class]="'loop-' + label.toLowerCase()"
                etMenuItem
                etMenuSelectionItem
                type="button"
              >
                {{ label }}
              </button>
            }
          </div>
        </div>
      </ng-template>
    </div>
  `,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuPanelDirective,
    MenuItemDirective,
    MenuSelectionGroupDirective,
    MenuSelectionItemDirective,
  ],
})
class MenuSelectionTestHost {
  sortBy = signal<unknown>('name');
  columns = signal<unknown>(['size']);
  standaloneChecked = signal(false);
  assigned = signal<unknown>('Bravo');
  loopLabels = ['Alpha', 'Bravo'];
}

const keydown = (element: Element, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('MenuSelectionGroupDirective', () => {
  let fixture: ComponentFixture<MenuSelectionTestHost>;
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
      imports: [MenuSelectionTestHost],
    });

    fixture = TestBed.createComponent(MenuSelectionTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('exposes group and selection item aria semantics', async () => {
    await openMenu();

    expect(query('.radio-group').getAttribute('role')).toBe('group');
    expect(query('.radio-name').getAttribute('role')).toBe('menuitemradio');
    expect(query('.radio-name').getAttribute('aria-checked')).toBe('true');
    expect(query('.radio-date').getAttribute('aria-checked')).toBe('false');
    expect(query('.check-size').getAttribute('role')).toBe('menuitemcheckbox');
    expect(query('.check-size').getAttribute('aria-checked')).toBe('true');
    expect(query('.standalone').getAttribute('role')).toBe('menuitemcheckbox');
  });

  it('selects a single value per radio group without closing the menu on click', async () => {
    await openMenu();

    query('.radio-date').click();
    tick();

    expect(fixture.componentInstance.sortBy()).toBe('date');
    expect(query('.radio-name').getAttribute('aria-checked')).toBe('false');
    expect(query('.radio-date').getAttribute('aria-checked')).toBe('true');
    expect(menu.open()).toBe(true);
  });

  it('toggles array values in a multiple group', async () => {
    await openMenu();

    query('.check-kind').click();
    tick();

    expect(fixture.componentInstance.columns()).toEqual(['size', 'kind']);

    query('.check-size').click();
    tick();

    expect(fixture.componentInstance.columns()).toEqual(['kind']);
    expect(menu.open()).toBe(true);
  });

  it('closes the menu tree when a selection is made via Enter', async () => {
    await openMenu();

    const radioDate = query('.radio-date');

    radioDate.focus();
    tick();
    keydown(radioDate, 'Enter');
    tick();

    expect(fixture.componentInstance.sortBy()).toBe('date');
    expect(menu.open()).toBe(false);
  });

  it('keeps the menu open when a selection is made via Space', async () => {
    await openMenu();

    const checkKind = query('.check-kind');

    checkKind.focus();
    tick();
    keydown(checkKind, ' ');
    tick();

    expect(fixture.componentInstance.columns()).toEqual(['size', 'kind']);
    expect(menu.open()).toBe(true);
  });

  it('syncs checked states when the value model changes from outside', async () => {
    await openMenu();

    fixture.componentInstance.sortBy.set('date');
    tick();

    expect(query('.radio-name').getAttribute('aria-checked')).toBe('false');
    expect(query('.radio-date').getAttribute('aria-checked')).toBe('true');
  });

  it('toggles a standalone checkbox item through its own checked model', async () => {
    await openMenu();

    query('.standalone').click();
    tick();

    expect(fixture.componentInstance.standaloneChecked()).toBe(true);
    expect(query('.standalone').getAttribute('aria-checked')).toBe('true');
    expect(menu.open()).toBe(true);

    query('.standalone').click();
    tick();

    expect(fixture.componentInstance.standaloneChecked()).toBe(false);
  });

  it('participates in the menu-wide roving focus in DOM order', async () => {
    await openMenu();

    const labels = menu.enabledItems().map((item) => item.textContent());

    expect(labels).toEqual(['Refresh', 'Name', 'Date', 'Size', 'Kind', 'Show hidden files', 'Alpha', 'Bravo']);

    keydown(query('.action'), 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(query('.radio-name'));
  });

  it('checks the preselected item of a loop-rendered group on every fresh mount', async () => {
    await openMenu();

    expect(query('.loop-bravo').getAttribute('aria-checked')).toBe('true');
    expect(query('.loop-alpha').getAttribute('aria-checked')).toBe('false');

    menu.hide();
    tick();

    while (menu.isMounted()) {
      await flushFrames();
      tick();
    }

    await openMenu();

    expect(query('.loop-bravo').getAttribute('aria-checked')).toBe('true');
  });
});
