import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { InventoryPageComponent, InventoryPageEntry, InventoryPageFrame } from './inventory-page.component';

const ENTRIES: InventoryPageEntry[] = [
  { number: 4, id: 'checkout.pay', label: 'Jetzt bezahlen', status: 'undeclared', kind: 'button', states: 3 },
  { number: 9, id: 'checkout.total', status: 'owned', owner: 'elements/price-box', kind: 'text', states: 1 },
];

const FRAMES: InventoryPageFrame[] = [
  {
    key: 'mobile',
    label: 'Checkout · Mobil',
    width: 400,
    height: 800,
    marks: [{ number: 4, status: 'undeclared', box: { x: 100, y: 200, width: 200, height: 40 } }],
  },
];

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(InventoryPageComponent);

  Object.entries({ entries: ENTRIES, frames: FRAMES, part: 'pages/checkout', ...inputs }).forEach(([name, value]) =>
    fixture.componentRef.setInput(name, value),
  );
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
  const rows = () =>
    [...element.querySelectorAll('ol > li')].map((row) =>
      [...row.querySelectorAll('span')]
        .filter((span) => !span.querySelector('span'))
        .map((span) => span.textContent?.replace(/\s+/gu, ' ').trim())
        .join(' | '),
    );

  return { fixture, element, button, rows };
};

describe('InventoryPageComponent', () => {
  it('lists each entry with its number, owner or status, and draws the marks of its own frames', async () => {
    const { element, rows } = await render({ inventory: 'open' });

    expect(element.textContent).toContain('pages/checkout');
    expect(rows()).toEqual([
      '4 | Jetzt bezahlen | checkout.pay | nicht deklariert · button · 3 Zustände',
      '9 | checkout.total | gehört zu elements/price-box · text · 1 Zustand',
    ]);
    expect(element.querySelector('figcaption')?.textContent?.trim()).toBe('Checkout · Mobil');
    expect(element.querySelector<HTMLElement>('figure .absolute')?.style.left).toBe('25%');
  });

  it('counts an undeclared entry as declared once the inventory is approvable, and emits approve', async () => {
    const { fixture, button, rows } = await render({ inventory: 'approvable', approval: 'Bereit zur Freigabe' });
    let approved = 0;

    fixture.componentInstance.approve.subscribe(() => approved++);
    button('Inventory freigeben')?.click();

    expect(rows()[0]).toContain('deklariert');
    expect(rows()[0]).not.toContain('nicht deklariert');
    expect(approved).toBe(1);
  });

  it('shows only the drawing note and blocks both buttons while loading', async () => {
    const { element, button } = await render({ inventory: 'loading' });

    expect(element.textContent).toContain('Inventory wird gezeichnet');
    expect(element.querySelector('ol')).toBeNull();
    expect(button('Neu laden')?.disabled).toBe(true);
    expect(button('Inventory freigeben')?.disabled).toBe(true);
  });
});
