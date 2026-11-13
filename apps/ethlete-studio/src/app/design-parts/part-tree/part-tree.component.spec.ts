import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { PartTree, PartTreeComponent, PartTreeLayer } from './part-tree.component';

const withTooltip = (root: Element | null | undefined, text: string) =>
  [...(root?.querySelectorAll<HTMLElement>('[aria-describedby]') ?? [])].find((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .some((id) => document.getElementById(id)?.textContent?.trim() === text),
  ) ?? null;

const LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [{ name: 'colors' }] },
  {
    title: 'Components',
    open: true,
    parts: [
      { name: 'button', selected: true },
      { name: 'title-bar', nested: [{ name: 'title-search' }, { name: 'a-rather-long-nested-part-name' }] },
      { name: 'select', warns: true },
    ],
  },
];

const render = async (layers: PartTreeLayer[] = LAYERS, extra: Partial<Omit<PartTree, 'layers'>> = {}) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(PartTreeComponent);

  fixture.componentRef.setInput('layers', layers);
  if (extra.sketches) fixture.componentRef.setInput('sketches', extra.sketches);
  if (extra.legacy) fixture.componentRef.setInput('legacy', extra.legacy);
  await fixture.whenStable();

  return fixture;
};

const rowsOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('[ethlete-tree-row-item]')];

const labelsOf = (element: HTMLElement) => rowsOf(element).map((row) => row.textContent?.trim());

describe('PartTreeComponent', () => {
  it('lists the layers, the parts of an open layer and a nested part under its open host, without states', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(labelsOf(element)).toEqual([
      'Foundations',
      'Components',
      'button',
      'title-bar',
      'title-search',
      'a-rather-long-nested-part-name',
      'select',
    ]);
    expect(rowsOf(element).map((row) => [row.dataset['kind'], row.style.getPropertyValue('--depth')])).toEqual([
      ['group', '0'],
      ['group', '0'],
      ['leaf', '1'],
      ['part', '1'],
      ['leaf', '2'],
      ['leaf', '2'],
      ['leaf', '1'],
    ]);
  });

  it('marks the selected row and the part that warns', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const [, , button, , , , select] = rowsOf(element);

    expect(button?.getAttribute('aria-current')).toBe('true');
    expect(withTooltip(select, 'Render-Check: 1 Warnung')).not.toBeNull();
  });

  it('puts the open sketches on top as part@name and the Legacy projects at the bottom', async () => {
    const fixture = await render([{ title: 'Pages', open: false, parts: [] }], {
      sketches: {
        open: true,
        items: [
          { part: 'command-palette', status: 'ready' },
          { part: 'part-tree', name: 'parts-only', status: 'in-progress', key: 'sketch:elements/part-tree@parts-only' },
        ],
      },
      legacy: {
        open: true,
        projects: [
          { name: 'acme', open: true, calls: ['home', { name: 'cart', key: 'legacy:acme/cart', selected: true }] },
          { name: 'other', calls: ['a'] },
        ],
      },
    });
    const element = fixture.nativeElement as HTMLElement;
    const activated: string[] = [];

    fixture.componentInstance.activate.subscribe((key) => activated.push(key));

    expect(labelsOf(element)).toEqual([
      'Sketches',
      'command-palette',
      'part-tree@parts-only',
      'Pages',
      'Legacy',
      'acme',
      'home',
      'cart',
      'other',
    ]);
    expect(rowsOf(element).map((row) => row.dataset['kind'])).toEqual([
      'group',
      'leaf',
      'leaf',
      'group',
      'group',
      'part',
      'leaf',
      'leaf',
      'part',
    ]);
    expect(withTooltip(element, 'Entwurf in Arbeit')).not.toBeNull();
    expect(rowsOf(element)[7]?.getAttribute('aria-current')).toBe('true');

    rowsOf(element)[2]?.click();
    rowsOf(element)[6]?.click();

    expect(activated).toEqual(['sketch:elements/part-tree@parts-only', 'Legacy/acme/home']);
  });

  it('opens a closed layer on click and emits the key of the activated row', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const activated: string[] = [];

    fixture.componentInstance.activate.subscribe((key) => activated.push(key));
    rowsOf(element)[0]?.click();
    await fixture.whenStable();

    expect(activated).toEqual(['Foundations']);
    expect(labelsOf(element).slice(0, 3)).toEqual(['Foundations', 'colors', 'Components']);
  });

  it('opens a closed layer on Space and emits the key of the activated row', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const activated: string[] = [];
    const expanded: (readonly string[])[] = [];
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });

    fixture.componentInstance.activate.subscribe((key) => activated.push(key));
    fixture.componentInstance.expandedChange.subscribe((keys) => expanded.push(keys));
    rowsOf(element)[0]?.dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(activated).toEqual(['Foundations']);
    expect(expanded).toHaveLength(1);
    expect(labelsOf(element).slice(0, 3)).toEqual(['Foundations', 'colors', 'Components']);
  });

  it('uses own keys, a closed host and an own warning title, and emits the open keys', async () => {
    const fixture = await render([
      {
        title: 'Components',
        key: 'components',
        open: true,
        parts: [
          {
            name: 'title-bar',
            key: 'components/title-bar',
            open: false,
            warns: 'LOAD: broken',
            nested: [{ name: 'title-search', key: 'components/title-bar/title-search' }],
          },
        ],
      },
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const activated: string[] = [];
    const expanded: (readonly string[])[] = [];

    fixture.componentInstance.activate.subscribe((key) => activated.push(key));
    fixture.componentInstance.expandedChange.subscribe((keys) => expanded.push(keys));

    expect(labelsOf(element)).toEqual(['Components', 'title-bar']);
    expect(withTooltip(element, 'LOAD: broken')).not.toBeNull();

    rowsOf(element)[1]?.click();
    await fixture.whenStable();
    rowsOf(element)[2]?.click();

    expect(labelsOf(element)).toEqual(['Components', 'title-bar', 'title-search']);
    expect(expanded.at(-1)).toEqual(['components', 'components/title-bar']);
    expect(activated).toEqual(['components/title-bar', 'components/title-bar/title-search']);
  });
});
