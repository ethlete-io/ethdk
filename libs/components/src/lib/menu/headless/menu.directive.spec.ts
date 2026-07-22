import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `
    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">Open menu</button>

      <ng-template etMenuSurface>
        <div class="root-panel" etMenuPanel>
          <button (click)="clicked.push('alpha')" class="item-alpha" etMenuItem type="button">Alpha</button>
          <button [disabled]="bravoDisabled()" class="item-bravo" etMenuItem type="button">Bravo</button>
          <!-- eslint-disable ethlete/prefer-static-boolean-properties -- closeOnActivate is tri-state (boolean | undefined); a transform would collapse its unset state -->
          <button
            [closeOnActivate]="false"
            (click)="clicked.push('charlie')"
            class="item-charlie"
            etMenuItem
            type="button"
          >
            Charlie
          </button>
          <!-- eslint-enable ethlete/prefer-static-boolean-properties -->

          @for (label of extraLabels(); track label) {
            <button class="item-extra" etMenuItem type="button">{{ label }}</button>
          }

          <div etMenu>
            <button class="submenu-trigger" etMenuItem etMenuTrigger type="button">Export</button>

            <ng-template etMenuSurface>
              <div class="sub-panel" etMenuPanel>
                <button (click)="clicked.push('delta')" class="sub-item-delta" etMenuItem type="button">Delta</button>
                <button class="sub-item-echo" etMenuItem type="button">Echo</button>
              </div>
            </ng-template>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  imports: [MenuDirective, MenuTriggerDirective, MenuSurfaceDirective, MenuPanelDirective, MenuItemDirective],
})
class MenuDirectiveTestHost {
  clicked: string[] = [];
  bravoDisabled = signal(false);
  extraLabels = signal<string[]>([]);
}

const keydown = (element: Element, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const pointerdown = (element: Element) =>
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

const pointerenter = (element: Element, pointerType = 'mouse') =>
  element.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, cancelable: true, pointerType }));

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('MenuDirective', () => {
  let fixture: ComponentFixture<MenuDirectiveTestHost>;
  let menu: MenuDirective;
  let trigger: HTMLButtonElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const query = <T extends HTMLElement>(selector: string) => {
    const element = document.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Expected element for selector "${selector}"`);
    }

    return element;
  };

  const openMenu = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MenuDirectiveTestHost],
    });

    fixture = TestBed.createComponent(MenuDirectiveTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
    trigger = fixture.nativeElement.querySelector('.root-trigger');
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('exposes menu trigger semantics while closed', () => {
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBeNull();
    expect(trigger.id).not.toBe('');
  });

  it('opens on trigger click and wires panel aria attributes', async () => {
    await openMenu();

    const panel = query('.root-panel');

    expect(menu.open()).toBe(true);
    expect(panel.getAttribute('role')).toBe('menu');
    expect(panel.getAttribute('aria-orientation')).toBe('vertical');
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('focuses the first enabled item after opening via click', async () => {
    await openMenu();

    const alpha = query('.item-alpha');

    expect(document.activeElement).toBe(alpha);
    expect(alpha.getAttribute('tabindex')).toBe('0');
    expect(query('.item-bravo').getAttribute('tabindex')).toBe('-1');
  });

  it('moves the active item with arrow keys, wrapping at the edges and skipping disabled items', async () => {
    fixture.componentInstance.bravoDisabled.set(true);
    fixture.detectChanges();

    await openMenu();

    const alpha = query('.item-alpha');
    const charlie = query('.item-charlie');

    keydown(alpha, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(charlie);

    keydown(charlie, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(query('.submenu-trigger'));

    keydown(query('.submenu-trigger'), 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(alpha);

    keydown(alpha, 'ArrowUp');
    tick();

    expect(document.activeElement).toBe(query('.submenu-trigger'));

    keydown(query('.submenu-trigger'), 'Home');
    tick();

    expect(document.activeElement).toBe(alpha);

    keydown(alpha, 'End');
    tick();

    expect(document.activeElement).toBe(query('.submenu-trigger'));
  });

  it('keeps the roving order in DOM order when items are added later', async () => {
    await openMenu();

    fixture.componentInstance.extraLabels.set(['Extra']);
    tick();

    const labels = menu.enabledItems().map((item) => item.textContent());

    expect(labels).toEqual(['Alpha', 'Bravo', 'Charlie', 'Extra', 'Export']);
  });

  it('registers a submenu trigger item with the parent menu, not the submenu', async () => {
    await openMenu();

    const submenu = menu.openSubmenu;

    expect(menu.enabledItems().some((item) => item.textContent() === 'Export')).toBe(true);
    expect(submenu()).toBeNull();
  });

  it('opens the submenu with ArrowRight and closes it with ArrowLeft, restoring focus to the trigger item', async () => {
    await openMenu();

    const submenuTrigger = query('.submenu-trigger');

    keydown(query('.item-alpha'), 'End');
    tick();
    keydown(submenuTrigger, 'ArrowRight');
    tick();
    await flushFrames();
    tick();

    const subPanel = query('.sub-panel');

    expect(menu.openSubmenu()).not.toBeNull();
    expect(subPanel.getAttribute('role')).toBe('menu');
    expect(document.activeElement).toBe(query('.sub-item-delta'));

    keydown(query('.sub-item-delta'), 'ArrowLeft');
    tick();

    expect(menu.openSubmenu()).toBeNull();
    expect(document.activeElement).toBe(submenuTrigger);
  });

  it('activates items via Enter by synthesizing a click and closes the tree', async () => {
    await openMenu();

    keydown(query('.item-alpha'), 'Enter');
    tick();

    expect(fixture.componentInstance.clicked).toEqual(['alpha']);
    expect(menu.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the menu open when an item opts out of closing on activation', async () => {
    await openMenu();

    query('.item-charlie').click();
    tick();

    expect(fixture.componentInstance.clicked).toEqual(['charlie']);
    expect(menu.open()).toBe(true);
  });

  it('does not activate disabled items', async () => {
    fixture.componentInstance.bravoDisabled.set(true);
    fixture.detectChanges();

    await openMenu();

    const bravo = query('.item-bravo');

    expect(bravo.getAttribute('aria-disabled')).toBe('true');

    bravo.click();
    tick();

    expect(menu.open()).toBe(true);
  });

  it('closes the whole tree on an outside pointerdown but not on one inside a pane', async () => {
    await openMenu();

    pointerdown(query('.root-panel'));
    tick();

    expect(menu.open()).toBe(true);

    pointerdown(document.body);
    tick();

    expect(menu.open()).toBe(false);
  });

  it('ignores pointerdowns on the trigger so the click toggle owns closing', async () => {
    await openMenu();

    pointerdown(trigger);
    tick();

    expect(menu.open()).toBe(true);

    trigger.click();
    tick();

    expect(menu.open()).toBe(false);
  });

  it('closes one level per Escape and focuses the trigger at the root', async () => {
    await openMenu();

    keydown(query('.item-alpha'), 'End');
    tick();
    keydown(query('.submenu-trigger'), 'ArrowRight');
    tick();
    await flushFrames();
    tick();

    keydown(query('.sub-item-delta'), 'Escape');
    tick();

    expect(menu.open()).toBe(true);
    expect(menu.openSubmenu()).toBeNull();

    keydown(query('.submenu-trigger'), 'Escape');
    tick();

    expect(menu.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the whole tree on Tab and returns focus to the trigger', async () => {
    await openMenu();

    keydown(query('.item-alpha'), 'Tab');
    tick();

    expect(menu.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('supports first-letter typeahead when no search input is present', async () => {
    await openMenu();

    keydown(query('.item-alpha'), 'c');
    tick();

    expect(document.activeElement).toBe(query('.item-charlie'));
  });

  it('opens via keyboard on the trigger and focuses the last item with ArrowUp', async () => {
    keydown(trigger, 'ArrowUp');
    tick();
    await flushFrames();
    tick();

    expect(menu.open()).toBe(true);
    expect(document.activeElement).toBe(query('.submenu-trigger'));
  });

  describe('hover intent', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens a submenu after the hover open delay and closes it after hovering another item', async () => {
      trigger.click();
      tick();

      const submenuTrigger = query('.submenu-trigger');

      pointerenter(submenuTrigger);
      tick();

      expect(menu.openSubmenu()).toBeNull();

      vi.advanceTimersByTime(150);
      tick();

      expect(menu.openSubmenu()).not.toBeNull();

      pointerenter(query('.item-alpha'));
      tick();
      vi.advanceTimersByTime(150);
      tick();

      expect(menu.openSubmenu()).not.toBeNull();

      vi.advanceTimersByTime(200);
      tick();

      expect(menu.openSubmenu()).toBeNull();
    });

    it('cancels a pending close when the pointer reaches the submenu panel', async () => {
      trigger.click();
      tick();

      pointerenter(query('.submenu-trigger'));
      vi.advanceTimersByTime(150);
      tick();

      expect(menu.openSubmenu()).not.toBeNull();

      pointerenter(query('.item-alpha'));
      tick();

      pointerenter(query('.sub-panel'));
      vi.advanceTimersByTime(1000);
      tick();

      expect(menu.openSubmenu()).not.toBeNull();
    });

    it('ignores touch pointer hovering', async () => {
      trigger.click();
      tick();

      pointerenter(query('.submenu-trigger'), 'touch');
      vi.advanceTimersByTime(1000);
      tick();

      expect(menu.openSubmenu()).toBeNull();
    });
  });
});
