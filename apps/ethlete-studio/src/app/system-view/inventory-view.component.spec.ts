import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { Inventory, InventoryControl } from '../../host/design-inventory';
import { THEMES } from '../../themes';
import { InventoryViewComponent } from './inventory-view.component';

const control = (number: number, id: string, status: InventoryControl['status']): InventoryControl => ({
  number,
  id,
  label: null,
  status,
  kind: 'button',
  inputs: ['pointer'],
  surfaces: ['raised'],
  owner: status === 'owned' ? 'components/button' : null,
  states: 3,
  box: { x: number * 100, y: 10, width: 50, height: 20 },
  covered: false,
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
  fixture.componentRef.setInput('shell', {
    tree: [],
    product: 'studio',
    products: ['studio'],
    project: 'ethlete-sdk',
    projects: ['ethlete-sdk'],
    panel: 'open',
  });
  await settle(fixture);

  const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

  Object.defineProperty(image, 'naturalWidth', { value: 1000 });
  Object.defineProperty(image, 'naturalHeight', { value: 500 });
  image.dispatchEvent(new Event('load'));
  await settle(fixture);

  return { fixture, posts, element: fixture.nativeElement as HTMLElement };
};

const buttonNamed = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === name);

const approveButton = (element: HTMLElement) => buttonNamed(element, 'Inventory freigeben') as HTMLButtonElement;

const marksOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('figure .absolute.border-2')];

const entriesOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('ol > li')];

const approvalOf = (element: HTMLElement) => element.querySelector('header > span')?.textContent ?? '';

const themeClassesOf = (element: Element | undefined) =>
  [...(element?.classList ?? [])].filter((name) => /danger|warning|brand/.test(name)).join(' ');

describe('InventoryViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists a covered control, with no outline or badge on the shot', async () => {
    const { element } = await render(
      inventoryOf([control(1, 'save', 'declared'), { ...control(2, 'under', 'declared'), covered: true }]),
    );

    expect(marksOf(element).map((mark) => mark.textContent?.trim())).toEqual(['1']);
    expect(entriesOf(element)).toHaveLength(2);
  });

  it('numbers each control on the shot and in the list, coloured by its status', async () => {
    const { element } = await render(
      inventoryOf([
        control(1, 'save', 'declared'),
        control(2, 'help', 'undeclared'),
        control(3, 'row', 'unclassified'),
      ]),
    );

    const boxes = marksOf(element);

    expect(boxes.map((box) => box.textContent?.trim())).toEqual(['1', '2', '3']);
    expect(boxes[1]?.style.left).toBe('20%');
    expect(boxes[1]?.style.width).toBe('5%');
    expect(themeClassesOf(boxes[0])).not.toMatch(/danger|warning/);
    expect(themeClassesOf(boxes[1])).toContain('danger');
    expect(themeClassesOf(boxes[2])).toContain('warning');
    expect(entriesOf(element).map((entry) => entry.textContent)).toEqual([
      expect.stringContaining('deklariert'),
      expect.stringContaining('nicht deklariert'),
      expect.stringContaining('nicht eingeordnet'),
    ]);
    expect(themeClassesOf(entriesOf(element)[1])).toContain('danger');
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
    expect(entriesOf(element)[0]?.textContent).toContain('gehört zu components/button');
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
    expect(approvalOf(element)).toContain('Von designer am');
    expect(approveButton(element).disabled).toBe(true);
  });

  it('says the page changed when the server refuses with 409', async () => {
    const { fixture, element } = await render(inventoryOf([control(1, 'save', 'declared')]), () =>
      json({ error: 'pages/merge changed since its inventory was shown - reload and check it again' }, 409),
    );

    approveButton(element).click();
    await settle(fixture);

    expect(approvalOf(element)).toContain('Die Seite hat sich geändert, seit diese Inventory gezeichnet wurde.');
  });
});
