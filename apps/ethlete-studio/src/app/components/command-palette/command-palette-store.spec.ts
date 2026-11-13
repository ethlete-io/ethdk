import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideOverlay } from '@ethlete/components';
import { TitleSearchComponent } from '../title-search/title-search.component';
import { PaletteEntry } from './command-palette.component';
import { injectCommandPaletteStore, provideCommandPaletteStore } from './command-palette-store';

const ENTRIES: PaletteEntry[] = [
  { kind: 'part', key: 'components/menu', label: 'menu' },
  { kind: 'page', key: 'pages/settings', label: 'settings' },
];

@Component({
  template: `<ethlete-title-search product="shop" part="menu" os="linux" />`,
  imports: [TitleSearchComponent],
  providers: [provideCommandPaletteStore()],
})
class HostComponent {
  public store = injectCommandPaletteStore();
  public chosen: PaletteEntry[] = [];

  constructor() {
    this.store.connect(signal(ENTRIES), (entry) => this.chosen.push(entry));
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const render = async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideOverlay()] });

  const fixture = TestBed.createComponent(HostComponent);

  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();

  const field = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  const palette = () => document.querySelector<HTMLElement>('ethlete-command-palette');
  const input = () => palette()?.querySelector('input') ?? null;
  const press = async (target: EventTarget, init: KeyboardEventInit) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
    await fixture.whenStable();
    await settle();
  };

  return { fixture, field, palette, input, press };
};

describe('CommandPaletteStore', () => {
  afterEach(() => document.querySelectorAll('ethlete-command-palette').forEach((node) => node.remove()));

  it('opens the palette from a click on the title search', async () => {
    const { field, palette, fixture } = await render();

    field.click();
    await fixture.whenStable();
    await settle();

    expect(palette()).not.toBeNull();
    expect(palette()?.closest('[role="dialog"]')?.getAttribute('aria-label')).toBe('Befehlsrahmen');
  });

  it('toggles the palette with Ctrl+K', async () => {
    const { palette, press, fixture } = await render();

    await press(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(palette()).not.toBeNull();

    await press(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    await fixture.whenStable();
    await settle();
    expect(palette()).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button'));
  });

  it('closes on Escape and returns focus to the search field', async () => {
    const { field, input, press, fixture } = await render();

    field.click();
    await fixture.whenStable();
    await settle();
    const search = input();

    expect(search).not.toBeNull();
    await press(search as HTMLInputElement, { key: 'Escape', code: 'Escape' });

    expect(document.activeElement).toBe(field);
  });

  it('opens the chosen entry and lists it as recently opened next time', async () => {
    const { field, input, press, palette, fixture } = await render();

    field.click();
    await fixture.whenStable();
    await settle();
    const search = input() as HTMLInputElement;

    search.value = 'sett';
    search.dispatchEvent(new Event('input'));
    await press(search, { key: 'Enter', code: 'Enter' });

    expect(fixture.componentInstance.chosen).toEqual([ENTRIES[1]]);

    field.click();
    await fixture.whenStable();
    await settle();

    expect(palette()?.textContent).toContain('Zuletzt geöffnet');
    expect(palette()?.textContent).toContain('settings');
  });
});
