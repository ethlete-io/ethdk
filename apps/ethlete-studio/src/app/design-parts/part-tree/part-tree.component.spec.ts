import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { TREE_ROW_LABELS } from '../../i18n/system-labels';
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
    expect(select?.querySelector('svg path[d="M8 2.5 14 13H2z"]')).not.toBeNull();
  });

  it('tags a nested part of another layer with its layer after the label', async () => {
    const element = (
      await render([
        {
          title: 'Pages',
          open: true,
          parts: [{ name: 'sketches', nested: [{ name: 'hold-trigger', layer: 'Components' }, { name: 'cell' }] }],
        },
      ])
    ).nativeElement as HTMLElement;
    const [, host, tagged, plain] = rowsOf(element);

    expect([host, tagged, plain].map((row) => row?.querySelector('.text-ui-xs')?.textContent?.trim() ?? null)).toEqual([
      null,
      'Components',
      null,
    ]);
  });

  it('draws a status mark on a nested sub-sketch row: a check once ready, a plain mark in progress', async () => {
    const element = (
      await render([], {
        sketches: {
          open: true,
          items: [
            {
              part: 'studio-menu',
              status: 'in-progress',
              nested: [
                { name: 'shortcuts-dialog', status: 'ready' },
                { name: 'about-dialog', status: 'in-progress' },
                { name: 'plain' },
              ],
            },
          ],
        },
      })
    ).nativeElement as HTMLElement;
    const [, , ready, progress, plain] = rowsOf(element);

    expect(ready?.querySelector('.text-et-theme path[d="m3.5 8.5 3 3 6-7"]')).not.toBeNull();
    expect(progress?.querySelector('svg path[d^="M10.5"]')).not.toBeNull();
    expect(plain?.querySelector('svg')).toBeNull();
  });

  it('shows a part hint as the tooltip of the full name and draws no tag', async () => {
    const element = (
      await render([
        {
          title: 'Pages',
          open: true,
          parts: [
            { name: 'sketches', nested: [{ name: 'foundations/colors', hint: 'nicht gezeichnet' }, { name: 'cell' }] },
          ],
        },
      ])
    ).nativeElement as HTMLElement;
    const [, , hinted, plain] = rowsOf(element);

    expect(hinted?.querySelector('.text-ui-xs')).toBeNull();
    expect(hinted?.textContent?.trim()).toBe('foundations/colors');
    expect(withTooltip(hinted, 'nicht gezeichnet')).not.toBeNull();
    expect(withTooltip(plain, 'nicht gezeichnet')).toBeNull();
  });

  // The human wants a plain tooltip on the warning icon.
  it('shows the warning text as the tooltip of the warning icon', async () => {
    const fixture = await render([
      { title: 'Components', open: true, parts: [{ name: 'select', warns: true, warnTitle: 'plain warning' }] },
    ]);

    expect(withTooltip(fixture.nativeElement, 'plain warning')).not.toBeNull();
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
    // B695: a sketch in progress only waits on the agent, so its status icon has no tooltip; a ready one keeps it.
    expect(withTooltip(element, TREE_ROW_LABELS.sketchReady)).not.toBeNull();
    expect(element.querySelectorAll('[aria-describedby]')).toHaveLength(1);
    expect(rowsOf(element)[7]?.getAttribute('aria-current')).toBe('true');

    rowsOf(element)[2]?.click();
    rowsOf(element)[6]?.click();

    expect(activated).toEqual(['sketch:elements/part-tree@parts-only', 'Legacy/acme/home']);
  });

  it('lists the targets of a sketch with several parts under it and emits the key of a picked target', async () => {
    const fixture = await render([], {
      sketches: {
        open: true,
        items: [
          {
            part: 'sketches',
            name: 'multi-part-head',
            status: 'ready',
            key: 'sketch:pages/sketches@multi-part-head',
            selected: true,
            nested: [{ name: 'components/badge' }, { name: 'elements/a-rather-long-variant-cell', key: 'own-key' }],
          },
          { part: 'zoom-chip', status: 'in-progress' },
        ],
      },
    });
    const element = fixture.nativeElement as HTMLElement;
    const activated: string[] = [];

    fixture.componentInstance.activate.subscribe((key) => activated.push(key));

    expect(labelsOf(element)).toEqual([
      'Sketches',
      'sketches@multi-part-head',
      'components/badge',
      'elements/a-rather-long-variant-cell',
      'zoom-chip',
    ]);
    expect(rowsOf(element).map((row) => [row.dataset['kind'], row.style.getPropertyValue('--depth')])).toEqual([
      ['group', '0'],
      ['part', '1'],
      ['leaf', '2'],
      ['leaf', '2'],
      ['leaf', '1'],
    ]);
    expect(rowsOf(element)[1]?.getAttribute('aria-current')).toBe('true');

    rowsOf(element)[2]?.click();
    rowsOf(element)[3]?.click();

    expect(activated).toEqual(['sketch:pages/sketches@multi-part-head/components/badge', 'own-key']);
  });

  it('draws a closed sketch host with its chevron and hides its targets', async () => {
    const fixture = await render([], {
      sketches: {
        open: true,
        items: [{ part: 'sketches', status: 'ready', open: false, nested: [{ name: 'components/badge' }] }],
      },
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(labelsOf(element)).toEqual(['Sketches', 'sketches']);
    expect(rowsOf(element)[1]?.dataset['kind']).toBe('part');
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

  it('uses own keys, a closed host, and emits the open keys', async () => {
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
            warns: true,
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

    rowsOf(element)[1]?.click();
    await fixture.whenStable();
    rowsOf(element)[2]?.click();

    expect(labelsOf(element)).toEqual(['Components', 'title-bar', 'title-search']);
    expect(expanded.at(-1)).toEqual(['components', 'components/title-bar']);
    expect(activated).toEqual(['components/title-bar', 'components/title-bar/title-search']);
  });
});
