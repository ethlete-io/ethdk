import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { Inventory, InventoryControl } from '../../host/design-inventory';
import { THEMES } from '../../themes';
import { InventoryViewComponent } from './inventory-view.component';

const control = (number: number, id: string, status: InventoryControl['status']): InventoryControl => ({
  number,
  id,
  status,
  kind: 'button',
  inputs: ['pointer'],
  surfaces: ['raised'],
  owner: status === 'owned' ? 'components/button' : null,
  states: 3,
  box: { x: number * 100, y: 10, width: 50, height: 20 },
});

const inventoryOf = (controls: InventoryControl[]): Inventory => ({
  part: 'pages/merge',
  hash: 'h1',
  ids: controls.map((listed) => listed.id),
  findings: controls.filter((listed) => listed.status === 'undeclared' || listed.status === 'unclassified').length,
  approval: null,
  state: { state: 'none' },
  reason: null,
  frames: [{ state: 'default', preset: 'desktop', width: null, shot: '/__design/shot?part=pages%2Fmerge', controls }],
});

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<InventoryViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const render = async (inventory: Inventory, post?: (body: unknown) => Promise<Response>) => {
  const posts: unknown[] = [];

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.includes('/__design/inventory-approve')) {
      const body: unknown = JSON.parse(String(init?.body));

      posts.push(body);

      return post ? post(body) : json(inventory);
    }

    return json(inventory);
  });

  const fixture = TestBed.createComponent(InventoryViewComponent);

  fixture.componentRef.setInput('port', 4999);
  fixture.componentRef.setInput('product', 'studio');
  fixture.componentRef.setInput('part', 'pages/merge');
  await settle(fixture);

  const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

  Object.defineProperty(image, 'naturalWidth', { value: 1000 });
  Object.defineProperty(image, 'naturalHeight', { value: 500 });
  image.dispatchEvent(new Event('load'));
  await settle(fixture);

  return { fixture, posts, element: fixture.nativeElement as HTMLElement };
};

const approveButton = (element: HTMLElement) => element.querySelector('[data-inventory-approve]') as HTMLButtonElement;

const themeClassesOf = (element: Element | undefined) =>
  [...(element?.classList ?? [])].filter((name) => /danger|warning|brand/.test(name)).join(' ');

describe('InventoryViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('numbers each control on the shot and in the list, coloured by its status', async () => {
    const { element } = await render(
      inventoryOf([
        control(1, 'save', 'declared'),
        control(2, 'help', 'undeclared'),
        control(3, 'row', 'unclassified'),
      ]),
    );

    const boxes = [...element.querySelectorAll<HTMLElement>('[data-inventory-box]')];

    expect(boxes.map((box) => [box.dataset['inventoryBox'], box.dataset['status'], box.textContent?.trim()])).toEqual([
      ['1', 'declared', '1'],
      ['2', 'undeclared', '2'],
      ['3', 'unclassified', '3'],
    ]);
    expect(boxes[1]?.style.left).toBe('20%');
    expect(boxes[1]?.style.width).toBe('5%');
    expect(themeClassesOf(boxes[0])).not.toMatch(/danger|warning/);
    expect(themeClassesOf(boxes[1])).toContain('danger');
    expect(themeClassesOf(boxes[2])).toContain('warning');
    expect(
      [...element.querySelectorAll<HTMLElement>('[data-inventory-entry]')].map((entry) => entry.dataset['status']),
    ).toEqual(['declared', 'undeclared', 'unclassified']);
  });

  it('keeps approve disabled while a control is red or amber', async () => {
    expect(approveButton((await render(inventoryOf([control(1, 'help', 'undeclared')]))).element).disabled).toBe(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });
    expect(approveButton((await render(inventoryOf([control(1, 'row', 'unclassified')]))).element).disabled).toBe(true);
  });

  it('lists a control an embedded part owns with its owner and keeps approve enabled', async () => {
    const { element } = await render(inventoryOf([control(1, 'main > et-button', 'owned')]));
    const entry = element.querySelector<HTMLElement>('[data-inventory-entry]');

    expect(entry?.dataset['status']).toBe('owned');
    expect(entry?.textContent).toContain('owned by components/button');
    expect(approveButton(element).disabled).toBe(false);
  });

  it('posts the part, the shown hash and the designer, and shows the approval', async () => {
    const shown = inventoryOf([control(1, 'save', 'declared')]);
    const approved: Inventory = {
      ...shown,
      state: { state: 'approved' },
      approval: { ids: ['save'], hash: 'h1', by: 'designer', at: '2026-10-30T10:00:00Z' },
    };
    const { fixture, posts, element } = await render(shown, () => json(approved));

    expect(approveButton(element).disabled).toBe(false);
    approveButton(element).click();
    await settle(fixture);

    expect(posts).toEqual([{ part: 'pages/merge', hash: 'h1', by: 'designer' }]);
    expect(element.querySelector('[data-inventory-approval]')?.textContent).toContain('Approved by designer');
    expect(approveButton(element).disabled).toBe(true);
  });

  it('says the page changed when the server refuses with 409', async () => {
    const { fixture, element } = await render(inventoryOf([control(1, 'save', 'declared')]), () =>
      json({ error: 'pages/merge changed since its inventory was shown - reload and check it again' }, 409),
    );

    approveButton(element).click();
    await settle(fixture);

    expect(element.querySelector('[data-inventory-error]')?.textContent).toContain(
      'The page changed since this inventory was drawn. Reload it',
    );
  });
});
