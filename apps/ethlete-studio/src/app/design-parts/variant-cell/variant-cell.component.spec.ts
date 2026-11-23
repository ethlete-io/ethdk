import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { VariantCellComponent } from './variant-cell.component';

@Component({
  selector: 'ethlete-variant-cell-host',
  imports: [VariantCellComponent],
  template: `<ethlete-variant-cell [loading]="busy" [width]="200" [height]="50" state="rest"
    ><div data-shot></div
  ></ethlete-variant-cell>`,
})
class HostComponent {
  protected busy = true;
}

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

  it('never wraps the label row, and truncates the state name at the frame width so the chips stay whole', async () => {
    const cell = await setup({
      state: 'default · phone',
      marked: true,
      first: true,
      width: 300,
      height: 90,
      scale: 0.2,
    });
    const row = cell.querySelector<HTMLElement>('[data-sk-label]');

    expect(row?.classList.contains('flex-wrap')).toBe(false);
    expect(row?.classList.contains('whitespace-nowrap')).toBe(true);
    expect(cell.querySelector('[data-sk-label-text]')?.classList.contains('wrap-anywhere')).toBe(false);
    expect(row?.classList.contains('overflow-hidden')).toBe(true);
    expect(cell.querySelector('[data-sk-label-text]')?.classList.contains('truncate')).toBe(true);
    expect(cell.querySelector('[data-sk-changed-mark]')?.classList.contains('shrink-0')).toBe(true);
    expect(cell.querySelector('[data-sk-first-change]')?.classList.contains('shrink-0')).toBe(true);
  });

  it('marks a changed cell with the geändert chip only when asked', async () => {
    const marked = await setup({ state: 'rest-hover', marked: true, width: 200, height: 50 });

    expect(marked.querySelector('[data-sk-changed-mark]')?.textContent?.trim()).toBe('geändert');
  });

  it('draws no geändert chip without the mark', async () => {
    const plain = await setup({ state: 'rest-hover', width: 200, height: 50 });

    expect(plain.querySelector('[data-sk-changed-mark]')).toBeNull();
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

  it('shows an aria-busy box and the loading badge while keeping the projected shot mounted', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(HostComponent);

    await fixture.whenStable();

    const cell = fixture.nativeElement as HTMLElement;

    expect(cell.querySelector('[data-loading][aria-busy="true"]')).not.toBeNull();
    expect(cell.querySelector('[data-loading-badge] et-spinner')).not.toBeNull();
    expect(cell.querySelector('[data-loading-badge]')?.textContent).toContain('Lädt');
    expect(cell.querySelector('[data-sk-label] [data-loading-badge]')).toBeNull();
    expect(cell.querySelector('[data-sk-frame]')?.contains(cell.querySelector('[data-loading-badge]'))).toBe(true);
    expect(cell.querySelector('[data-shot]')).not.toBeNull();
    expect(cell.querySelector('[data-shot]')?.parentElement?.classList.contains('invisible')).toBe(true);
  });

  it('shows no loading box or badge by default', async () => {
    const cell = await setup({ state: 'rest', width: 200, height: 50 });

    expect(cell.querySelector('[data-loading]')).toBeNull();
    expect(cell.querySelector('[data-loading-badge]')).toBeNull();
  });
});
