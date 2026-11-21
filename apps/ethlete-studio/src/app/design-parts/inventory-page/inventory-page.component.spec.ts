import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { InventoryPageComponent, InventoryPageEntry } from './inventory-page.component';

const PAGES: InventoryPageEntry[] = [
  {
    part: 'pages/checkout',
    approval: 'open',
    approvalLabel: 'Noch nicht freigegeben',
    controls: [
      {
        number: '1',
        name: 'Jetzt bezahlen',
        detail: 'nicht deklariert',
        tone: 'error',
        box: { x: 100, y: 200, width: 200, height: 40 },
      },
      { number: '2', name: 'Summe', detail: 'gehört zu elements/price-box', tone: 'ok', box: null },
    ],
    assets: [],
    overlays: [{ number: 'O1', name: 'Zahlart', detail: 'gehört zu components/menu', tone: 'ok', box: null }],
    shot: null,
    size: { width: 400, height: 800 },
  },
  {
    part: 'pages/a-very-long-page-name-that-keeps-going',
    approval: 'approvable',
    approvalLabel: 'Noch nicht freigegeben',
    controls: [],
    assets: [{ number: 'A1', name: 'Logo', detail: 'gehört zu foundations/logo', tone: 'ok', box: null }],
    overlays: [],
    shot: null,
    size: null,
  },
];

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(InventoryPageComponent);

  Object.entries({ pages: PAGES, ...inputs }).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    );
  const text = (selector: string) =>
    [...element.querySelectorAll(selector)].map((node) =>
      [...node.querySelectorAll('span:not(:has(span))')].map((span) => span.textContent?.trim()).join(' '),
    );

  return { fixture, element, button, text };
};

describe('InventoryPageComponent', () => {
  it('draws a frame per page with its open count or status, and marks only rows with a box', async () => {
    const { element, text } = await render({});

    expect(text('figcaption')).toEqual([
      'pages/checkout 1 offen',
      'pages/a-very-long-page-name-that-keeps-going bereit zur Freigabe',
    ]);

    const marks = [...element.querySelectorAll<HTMLElement>('figure .absolute.border-2')];

    expect(marks.map((mark) => mark.textContent?.trim())).toEqual(['1']);
    expect(marks[0]?.style.left).toBe('25%');
    expect(element.querySelectorAll<HTMLElement>('figure')[1]?.style.left).toBe('448px');
  });

  it('lists the first page in three sections when nothing is selected', async () => {
    const { element, text } = await render({});

    expect(element.querySelector('aside h2')?.textContent?.trim()).toBe('pages/checkout');
    expect(
      [...element.querySelectorAll('aside h3')].map((node) => node.textContent?.replace(/\s+/gu, ' ').trim()),
    ).toEqual(['Bedienelemente 2', 'Assets 0', 'Overlays 1']);
    expect(text('aside li')).toEqual([
      '1 Jetzt bezahlen nicht deklariert',
      '2 Summe gehört zu elements/price-box',
      'O1 Zahlart gehört zu components/menu',
    ]);
    expect([...element.querySelectorAll('aside section p')].map((node) => node.textContent?.trim())).toEqual(['Keine']);
  });

  it('shows the selected page and enables approve only while it is approvable and nothing is approving', async () => {
    const { fixture, element, button } = await render({ selected: 'pages/a-very-long-page-name-that-keeps-going' });
    let approved = 0;

    fixture.componentInstance.approve.subscribe(() => approved++);

    expect(element.querySelector('aside h2')?.textContent?.trim()).toBe('pages/a-very-long-page-name-that-keeps-going');
    expect(element.querySelector('figure figcaption span')?.classList).not.toContain('font-ui-strong');
    button('Inventory freigeben')?.click();
    expect(approved).toBe(1);

    fixture.componentRef.setInput('approving', true);
    await fixture.whenStable();
    expect(button('Inventory freigeben')?.disabled).toBe(true);
  });

  it('keeps approve off for an open page and emits reload', async () => {
    const { fixture, button } = await render({});
    let reloads = 0;

    fixture.componentInstance.reload.subscribe(() => reloads++);
    button('Neu laden')?.click();

    expect(button('Inventory freigeben')?.disabled).toBe(true);
    expect(reloads).toBe(1);
  });

  it('shows only the drawing note and blocks both buttons while loading', async () => {
    const { element, button } = await render({ inventory: 'loading', pages: null });

    expect(element.textContent).toContain('Inventory wird gezeichnet');
    expect(element.querySelector('figure')).toBeNull();
    expect(element.querySelector('ol')).toBeNull();
    expect(button('Neu laden')?.disabled).toBe(true);
    expect(button('Inventory freigeben')?.disabled).toBe(true);
  });
});
