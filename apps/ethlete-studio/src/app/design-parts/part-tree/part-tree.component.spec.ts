import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { PartTreeComponent, PartTreeLayer } from './part-tree.component';

const LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [{ name: 'colors', leaf: true }] },
  {
    title: 'Components',
    open: true,
    parts: [
      { name: 'button', leaf: true, selected: true },
      { name: 'form-field', states: [{ name: 'empty' }, { name: 'filled', inert: true }] },
      { name: 'select', warns: true },
    ],
  },
];

const render = async (layers: PartTreeLayer[] = LAYERS) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(PartTreeComponent);

  fixture.componentRef.setInput('layers', layers);
  await fixture.whenStable();

  return fixture;
};

const rowsOf = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('[ethlete-tree-row-item]')];

const labelsOf = (element: HTMLElement) => rowsOf(element).map((row) => row.textContent?.trim());

describe('PartTreeComponent', () => {
  it('lists the layers, the parts of an open layer and the frames of a part with states', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(labelsOf(element)).toEqual([
      'Foundations',
      'Components',
      'button',
      'form-field',
      'empty',
      'filled',
      'select',
    ]);
    expect(rowsOf(element).map((row) => [row.dataset['kind'], row.style.getPropertyValue('--depth')])).toEqual([
      ['group', '0'],
      ['group', '0'],
      ['leaf', '1'],
      ['part', '1'],
      ['leaf', '2'],
      ['leaf', '2'],
      ['part', '1'],
    ]);
  });

  it('marks the selected row and the part that warns', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const [, , button, , , , select] = rowsOf(element);

    expect(button?.getAttribute('aria-current')).toBe('true');
    expect(select?.querySelector('[title="Render-Check: 1 Warnung"]')).not.toBeNull();
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
});
