import { ApplicationRef, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { injectOverlayManager, OverlayRef } from '../../overlay';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `<button class="dialog-button" type="button">Dialog</button>`,
})
class DialogContent {}

@Component({
  template: `
    <button (click)="outsideClicks = outsideClicks + 1" class="outside" type="button">Outside</button>

    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">Open menu</button>

      <ng-template etMenuSurface>
        <div etMenuPanel>
          <button (click)="openDialog()" class="item-dialog" etMenuItem type="button">Open dialog</button>
        </div>
      </ng-template>
    </div>
  `,
  imports: [MenuDirective, MenuTriggerDirective, MenuSurfaceDirective, MenuPanelDirective, MenuItemDirective],
})
class Host {
  private overlayManager = injectOverlayManager();

  outsideClicks = 0;
  dialog: OverlayRef<DialogContent> | null = null;

  openDialog() {
    this.dialog = this.overlayManager.open(DialogContent, { mode: 'modal' });
  }
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('Menu outside pointer and focus restoration', () => {
  let fixture: ComponentFixture<Host>;
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
    TestBed.configureTestingModule({ imports: [Host] });

    fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
    trigger = fixture.nativeElement.querySelector('.root-trigger');
  });

  afterEach(() => {
    fixture.componentInstance.dialog?.close();
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
    fixture.nativeElement.remove();
  });

  it('closes on an outside pointerdown without swallowing it, so the click reaches the element underneath', async () => {
    await openMenu();

    expect(document.querySelector('.et-overlay-runtime-backdrop')).toBeNull();

    const outside = query<HTMLButtonElement>('.outside');
    const pointerdown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    outside.dispatchEvent(pointerdown);
    tick();

    expect(menu.open()).toBe(false);
    expect(pointerdown.defaultPrevented).toBe(false);

    outside.click();

    expect(fixture.componentInstance.outsideClicks).toBe(1);
  });

  it('does not move focus to the trigger on an outside close', async () => {
    await openMenu();

    const outside = query<HTMLButtonElement>('.outside');
    outside.focus();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    tick();

    expect(menu.open()).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it('returns focus to the menu trigger when a dialog opened from a menu item is closed', async () => {
    await openMenu();

    const item = query('.item-dialog');
    item.focus();
    item.click();
    tick();
    await flushFrames();
    tick();

    expect(menu.open()).toBe(false);
    expect(document.querySelector('.dialog-button')).not.toBeNull();

    fixture.componentInstance.dialog?.close();
    tick();
    await flushFrames();
    tick();

    expect(document.querySelector('.dialog-button')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
