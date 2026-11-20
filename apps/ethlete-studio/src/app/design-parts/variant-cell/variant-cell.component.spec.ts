import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { VariantCellComponent } from './variant-cell.component';

const setup = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(VariantCellComponent);

  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);

  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

describe('VariantCellComponent', () => {
  it('shows the state name and sizes the frame by the scale', async () => {
    const cell = await setup({ state: 'hover-focus-visible', width: 300, height: 90, scale: 0.4 });
    const frame = cell.querySelector<HTMLElement>('[data-sk-frame]');

    expect(cell.querySelector('[data-sk-label]')?.textContent).toContain('hover-focus-visible');
    expect(frame?.style.width).toBe('120px');
    expect(frame?.style.height).toBe('36px');
  });

  it('dims an unchanged state and reads unverändert', async () => {
    const cell = await setup({ state: 'rest', same: true, width: 200, height: 50 });

    expect(cell.querySelector('[data-sk-label]')?.textContent).toContain('rest · unverändert');
    expect(cell.querySelector('[data-sk-frame]')?.classList.contains('opacity-50')).toBe(true);
  });

  it('marks the first change and the selected frame', async () => {
    const cell = await setup({ state: 'a', first: true, selected: true, width: 200, height: 50 });

    expect(cell.querySelector('[data-sk-first-change]')).not.toBeNull();
    expect(cell.querySelector('[data-sk-frame]')?.getAttribute('data-selected')).toBe('');
    expect(cell.querySelector('[data-frame-border]')?.className).toContain('outline-solid');
  });

  it('draws the crop mark and the stack bars for a cropped group', async () => {
    const cell = await setup({
      state: 'a',
      width: 200,
      height: 100,
      shown: 40,
      crop: 'scale(2)',
      mark: { left: 1, top: 2, width: 30, height: 20 },
      stacked: true,
      rowWidth: 200,
    });

    expect(cell.querySelector('[data-sk-frame]')?.hasAttribute('data-sk-cropped')).toBe(true);
    expect(cell.querySelector('[data-sk-crop-mark]')).not.toBeNull();
    expect(cell.querySelectorAll('[data-sk-crop-stack]').length).toBe(2);
  });

  it('hides the label row when the labels are too small', async () => {
    const cell = await setup({ state: 'a', labelHidden: true, width: 100, height: 20 });

    expect(cell.querySelector('[data-sk-label]')?.classList.contains('hidden')).toBe(true);
  });
});
