import { ApplicationRef, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { MenuContextTriggerDirective } from './menu-context-trigger.directive';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `
    <div etMenu>
      <div class="context-zone" etMenuContextTrigger>Right click me</div>

      <ng-template etMenuSurface>
        <div class="root-panel" etMenuPanel>
          <button class="item" etMenuItem type="button">Copy</button>
        </div>
      </ng-template>
    </div>
  `,
  imports: [MenuDirective, MenuContextTriggerDirective, MenuSurfaceDirective, MenuPanelDirective, MenuItemDirective],
})
class MenuContextTriggerTestHost {}

describe('MenuContextTriggerDirective', () => {
  let fixture: ComponentFixture<MenuContextTriggerTestHost>;
  let menu: MenuDirective;
  let zone: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const openContextMenu = (x: number, y: number) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });

    zone.dispatchEvent(event);
    tick();

    return event;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MenuContextTriggerTestHost],
    });

    fixture = TestBed.createComponent(MenuContextTriggerTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
    zone = fixture.nativeElement.querySelector('.context-zone');
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('opens at the pointer position with a virtual reference element', () => {
    const event = openContextMenu(120, 80);

    expect(event.defaultPrevented).toBe(true);
    expect(menu.open()).toBe(true);
    expect(menu.anchorPoint()).toEqual({ x: 120, y: 80 });

    const positionStrategy = menu.overlayRef()?.config.strategies?.()[0]?.strategy.config.positionStrategy?.();

    expect(positionStrategy?.kind).toBe('anchored');

    if (positionStrategy?.kind === 'anchored') {
      const reference = positionStrategy.referenceElement;
      const rect = reference.getBoundingClientRect();

      expect(reference instanceof HTMLElement).toBe(false);
      expect(rect.x).toBe(120);
      expect(rect.y).toBe(80);
      expect(rect.width).toBe(0);
    }
  });

  it('repositions in place on a second right click while open', () => {
    openContextMenu(120, 80);

    const overlayRefBeforeReposition = menu.overlayRef();

    openContextMenu(300, 200);

    expect(menu.open()).toBe(true);
    expect(menu.anchorPoint()).toEqual({ x: 300, y: 200 });
    // the overlay is repositioned, not closed and remounted
    expect(menu.overlayRef()).toBe(overlayRefBeforeReposition);
  });

  it('clears the anchor point after closing', async () => {
    openContextMenu(120, 80);

    menu.closeAll();
    tick();

    expect(menu.open()).toBe(false);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    tick();

    expect(menu.anchorPoint()).toBeNull();
  });
});
