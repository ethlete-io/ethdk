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

  it('names the folded states it stands in for beside the state name', async () => {
    const cell = await setup({ state: 'film', width: 168, height: 250, sameAsRest: ['film-hover', 'film-active'] });

    expect(cell.querySelector('[data-sk-same-as-rest]')?.textContent).toBe('film-hover, film-active = rest');
  });

  it('shows no rest note while it stands in for no folded state', async () => {
    const cell = await setup({ state: 'film', width: 168, height: 250 });

    expect(cell.querySelector('[data-sk-same-as-rest]')).toBeNull();
  });

  it('wraps the label row at the frame width, so the full state name and the chips stay visible', async () => {
    const cell = await setup({
      state: 'default · phone',
      sameAsRest: ['default · tablet'],
      width: 300,
      height: 90,
      scale: 0.2,
    });
    const row = cell.querySelector<HTMLElement>('[data-sk-label]');

    expect(row?.classList.contains('flex-wrap')).toBe(true);
    expect(row?.classList.contains('whitespace-nowrap')).toBe(false);
    expect(cell.querySelector('[data-sk-label-text]')?.classList.contains('wrap-anywhere')).toBe(true);
    expect(row?.classList.contains('overflow-hidden')).toBe(false);
    expect(cell.querySelector('[data-sk-label-text]')?.classList.contains('truncate')).toBe(false);
  });

  // The human decided Studio does not show the changed badge or the first-change line.
  it('draws no changed badge and no first-change line on a changed cell', async () => {
    const cell = await setup({ state: 'rest-hover', changed: 'b', width: 200, height: 50 });

    expect(cell.textContent).not.toContain('geändert');
    expect(cell.textContent).not.toContain('erste Änderung');
    expect(cell.querySelector('[data-sk-changed-mark], [data-sk-first-change]')).toBeNull();
  });

  it('dims an unchanged state and reads unverändert', async () => {
    const cell = await setup({ state: 'rest', same: true, width: 200, height: 50 });

    expect(cell.querySelector('[data-sk-label]')?.textContent).toContain('rest · unverändert');
    expect(cell.querySelector('[data-sk-frame]')?.classList.contains('opacity-50')).toBe(true);
  });

  it('marks the selected frame', async () => {
    const cell = await setup({ state: 'a', selected: true, width: 200, height: 50 });

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
