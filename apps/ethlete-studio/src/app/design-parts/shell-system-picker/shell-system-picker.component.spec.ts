import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ShellSystemPickerComponent } from './shell-system-picker.component';

const setup = async (inputs: { product?: string; products?: string[]; open?: boolean }) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ShellSystemPickerComponent);

  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);

  const picked: string[] = [];

  fixture.componentInstance.productChange.subscribe((name) => picked.push(name));
  await fixture.whenStable();

  return { fixture, picked };
};

describe('ShellSystemPickerComponent', () => {
  it('shows the current product on the trigger', async () => {
    const { fixture } = await setup({ product: 'a-very-long-design-system-name', products: ['x'] });

    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('a-very-long-design-system-name');
  });

  it('lists every product with the current one checked when open', async () => {
    const { fixture } = await setup({ product: 'shop', products: ['shop', 'admin', 'portal', 'media'], open: true });

    const items = Array.from(document.querySelectorAll('et-menu-radio-item'));

    expect(items.map((item) => item.textContent?.trim())).toEqual(['shop', 'admin', 'portal', 'media']);
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('emits productChange for another product only', async () => {
    const { fixture, picked } = await setup({ product: 'shop', products: ['shop', 'admin'], open: true });

    fixture.componentInstance['selectProduct']('shop');
    fixture.componentInstance['selectProduct']('admin');

    expect(picked).toEqual(['admin']);
  });
});
