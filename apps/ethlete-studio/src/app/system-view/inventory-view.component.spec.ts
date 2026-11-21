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
  frames: [
    {
      state: 'default',
      preset: 'desktop',
      width: null,
      shot: '/__design/shot?part=pages%2Fmerge',
      controls,
      items: [],
    },
  ],
});

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async (fixture: ComponentFixture<InventoryViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const render = async (
  inventory: Inventory,
  post?: (body: unknown) => Promise<Response>,
  pages: Record<string, Inventory> = { [inventory.part]: inventory },
  selected: string | null = null,
) => {
  const posts: unknown[] = [];
  const reads: string[] = [];

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.includes('/__design/inventory-approve')) {
      const body: unknown = JSON.parse(String(init?.body));

      posts.push(body);

      return post ? post(body) : json(inventory);
    }

    const part = new URL(url).searchParams.get('part') ?? '';

    reads.push(part);

    return json(pages[part]);
  });

  const fixture = TestBed.createComponent(InventoryViewComponent);

  fixture.componentRef.setInput('port', 4999);
  fixture.componentRef.setInput('product', 'studio');
  fixture.componentRef.setInput('pages', Object.keys(pages));
  fixture.componentRef.setInput('selected', selected);
  fixture.componentRef.setInput('shell', {
    tree: { layers: [] },
    product: 'studio',
    products: ['studio'],
    project: 'ethlete-sdk',
    projects: ['ethlete-sdk'],
    panel: 'open',
  });
  await settle(fixture);

  for (const image of fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>) {
    Object.defineProperty(image, 'naturalWidth', { value: 1000 });
    Object.defineProperty(image, 'naturalHeight', { value: 500 });
    image.dispatchEvent(new Event('load'));
  }
  await settle(fixture);

  return { fixture, posts, reads, element: fixture.nativeElement as HTMLElement };
};

const buttonNamed = (element: HTMLElement, name: string) =>
  [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === name);

const approveButton = (element: HTMLElement) => buttonNamed(element, 'Inventory freigeben') as HTMLButtonElement;

const marksOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('figure .absolute.border-2')];

const leafTextOf = (node: Element) =>
  [...node.querySelectorAll('span:not(:has(span))')].map((span) => span.textContent?.trim()).join(' ');

const entriesOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('ol > li')];

const approvalOf = (element: HTMLElement) => element.querySelector('aside header > p')?.textContent ?? '';

const themeClassesOf = (element: Element | undefined) =>
  [...(element?.classList ?? [])].filter((name) => /danger|warning|brand/.test(name)).join(' ');

describe('InventoryViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows a failed inventory shot as an error', async () => {
    const { fixture, element } = await render(inventoryOf([control(1, 'save', 'declared')]));

    element.querySelector('img')?.dispatchEvent(new Event('error'));
    await settle(fixture);

    expect(element.querySelector('figure [data-shot-failed]')?.textContent).toContain('Render failed');
  });

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

  it('reads each page once, shows a frame per page and approves the selected page', async () => {
    const merge = inventoryOf([control(1, 'save', 'undeclared')]);
    const inbox: Inventory = {
      ...inventoryOf([control(1, 'reply', 'declared')]),
      part: 'pages/inbox',
      hash: 'h2',
    };
    const { fixture, posts, reads, element } = await render(
      merge,
      () => json({ ...inbox, state: { state: 'approved' } }),
      { 'pages/merge': merge, 'pages/inbox': inbox },
      'pages/inbox',
    );

    expect(reads.sort()).toEqual(['pages/inbox', 'pages/merge']);
    expect([...element.querySelectorAll('figcaption')].map(leafTextOf)).toEqual([
      'pages/merge 1 offen',
      'pages/inbox bereit zur Freigabe',
    ]);
    expect(element.querySelector('aside h2')?.textContent?.trim()).toBe('pages/inbox');

    approveButton(element).click();
    await settle(fixture);

    expect(posts).toEqual([{ part: 'pages/inbox', hash: 'h2', by: 'designer' }]);
  });

  it('lists each asset and overlay once across frames, numbered per kind', async () => {
    const item = (number: number, kind: 'asset' | 'overlay', id: string, owner: string | null) => ({
      number,
      kind,
      status: owner ? ('owned' as const) : ('finding' as const),
      what: 'svg',
      id,
      label: null,
      owner,
      box: null,
      covered: false,
    });
    const base = inventoryOf([control(1, 'save', 'declared')]);
    const frame = base.frames[0]!;
    const inventory: Inventory = {
      ...base,
      frames: [
        {
          ...frame,
          items: [item(1, 'asset', 'logo', 'foundations/logo'), item(1, 'overlay', 'menu', 'components/menu')],
        },
        {
          ...frame,
          state: 'open',
          items: [item(1, 'asset', 'arrow', null), item(2, 'asset', 'logo', 'foundations/logo')],
        },
      ],
    };
    const { element } = await render(inventory);

    expect(entriesOf(element).map(leafTextOf)).toEqual([
      '1 save deklariert',
      'A1 svg gehört zu foundations/logo',
      'A2 svg Inline-SVG, nicht aus den Foundations',
      'O1 svg gehört zu components/menu',
    ]);
    expect(approveButton(element).disabled).toBe(true);
  });
});
