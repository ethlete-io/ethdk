import { ApplicationRef, Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSearchDirective } from './menu-search.directive';
import { MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuDirective } from './menu.directive';

@Component({
  template: `
    <div etMenu>
      <button class="root-trigger" etMenuTrigger type="button">Open menu</button>

      <ng-template etMenuSurface>
        <div class="root-panel" etMenuPanel>
          <input [(query)]="query" [loading]="loading()" [error]="error()" class="search" etMenuSearch />

          @for (label of filteredLabels(); track label) {
            <button class="item" etMenuItem type="button">{{ label }}</button>
          }
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
    MenuSearchDirective,
  ],
})
class MenuSearchTestHost {
  query = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  labels = ['Alpha', 'Bravo', 'Charlie'];
  filteredLabels = computed(() =>
    this.labels.filter((label) => label.toLowerCase().includes(this.query().toLowerCase())),
  );
}

const keydown = (element: Element, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('MenuSearchDirective', () => {
  let fixture: ComponentFixture<MenuSearchTestHost>;
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
      imports: [MenuSearchTestHost],
    });

    fixture = TestBed.createComponent(MenuSearchTestHost);
    fixture.detectChanges();
    menu = fixture.debugElement.query(By.directive(MenuDirective)).injector.get(MenuDirective);
  });

  afterEach(() => {
    menu.hide();
    tick();
    document.querySelectorAll('.et-overlay-runtime-root').forEach((element) => element.remove());
  });

  it('receives focus when the menu opens', async () => {
    await openMenu();

    expect(document.activeElement).toBe(query('.search'));
  });

  it('keeps focus in the search field when the pointer crosses an item', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');

    search.value = 'br';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    // Hovering marks the item active but must not take focus - otherwise the rest of what someone is
    // typing goes nowhere the moment the pointer drifts over the list.
    query('.item').dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, pointerType: 'mouse' }));
    tick();

    expect(document.activeElement).toBe(search);
  });

  it('updates the query model from typed input and filters via the consumer', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');

    search.value = 'br';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    expect(fixture.componentInstance.query()).toBe('br');
    expect(document.querySelectorAll('.item')).toHaveLength(1);
    expect(query('.item').textContent?.trim()).toBe('Bravo');
  });

  it('clears the query on Escape instead of closing while text is present', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');

    search.value = 'br';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    keydown(search, 'Escape');
    tick();

    expect(fixture.componentInstance.query()).toBe('');
    expect(menu.open()).toBe(true);

    keydown(search, 'Escape');
    tick();

    expect(menu.open()).toBe(false);
  });

  it('moves focus between the input and the items with arrow keys, using the input as a cycle stop', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');
    const items = document.querySelectorAll<HTMLElement>('.item');

    keydown(search, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(items[0]);

    keydown(items[0] as HTMLElement, 'ArrowUp');
    tick();

    expect(document.activeElement).toBe(search);

    keydown(search, 'ArrowUp');
    tick();

    expect(document.activeElement).toBe(items[2]);

    keydown(items[2] as HTMLElement, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(search);
  });

  it('keeps the query when the menu reopens and selects the text so typing replaces it', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');

    search.value = 'br';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    tick();

    menu.hide();
    tick();

    // the overlay unmounts asynchronously - wait until it is gone before reopening
    while (menu.isMounted()) {
      await flushFrames();
      tick();
    }

    await openMenu();

    const reopenedSearch = query<HTMLInputElement>('.search');

    expect(reopenedSearch.value).toBe('br');
    expect(document.activeElement).toBe(reopenedSearch);
    expect(reopenedSearch.selectionStart).toBe(0);
    expect(reopenedSearch.selectionEnd).toBe(2);
  });

  it('marks the panel busy while loading', async () => {
    await openMenu();

    const panel = query('.root-panel');

    expect(panel.getAttribute('aria-busy')).toBeNull();

    fixture.componentInstance.loading.set(true);
    tick();

    expect(panel.getAttribute('aria-busy')).toBe('true');

    fixture.componentInstance.loading.set(false);
    tick();

    expect(panel.getAttribute('aria-busy')).toBeNull();
  });

  it('marks the input invalid and points it at the error element while an error is present', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');
    const searchDirective = menu.registeredSearch();

    if (!searchDirective) {
      throw new Error('Expected a registered search directive');
    }

    searchDirective.errorElementId.set('error-line');

    expect(search.getAttribute('aria-invalid')).toBeNull();
    expect(search.getAttribute('aria-describedby')).toBeNull();

    fixture.componentInstance.error.set('Something went wrong');
    tick();

    expect(search.getAttribute('aria-invalid')).toBe('true');
    expect(search.getAttribute('aria-describedby')).toBe('error-line');

    fixture.componentInstance.error.set(null);
    tick();

    expect(search.getAttribute('aria-invalid')).toBeNull();
    expect(search.getAttribute('aria-describedby')).toBeNull();
  });

  it('forwards printable characters typed on items into the search input', async () => {
    await openMenu();

    const search = query<HTMLInputElement>('.search');
    const items = document.querySelectorAll<HTMLElement>('.item');

    keydown(search, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(items[0]);

    keydown(items[0] as HTMLElement, 'b');
    tick();

    expect(document.activeElement).toBe(search);
    expect(search.value).toBe('b');
    expect(fixture.componentInstance.query()).toBe('b');
  });
});
