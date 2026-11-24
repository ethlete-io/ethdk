import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SHELL_LABELS } from '../../i18n/shell-labels';
import { ProductSdk, ShellSystemPickerComponent } from './shell-system-picker.component';

const setup = async (inputs: { product?: string; products?: string[]; open?: boolean; sdk?: ProductSdk | null }) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ShellSystemPickerComponent);

  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);

  const picked: string[] = [];
  const sdks: ProductSdk[] = [];

  fixture.componentInstance.productChange.subscribe((name) => picked.push(name));
  fixture.componentInstance.sdkChange.subscribe((sdk) => sdks.push(sdk));
  await fixture.whenStable();

  return { fixture, picked, sdks };
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

  it('offers the SDK choice of the product with its current answer checked', async () => {
    await setup({ product: 'tomflix', products: ['tomflix', 'shop'], open: true, sdk: 'own' });

    const groups = Array.from(document.querySelectorAll('et-menu-radio-group'));
    const choices = Array.from(groups[1]?.querySelectorAll('et-menu-radio-item') ?? []);

    expect(groups[1]?.textContent).toContain(SHELL_LABELS.sdkQuestion);
    expect(choices.map((item) => item.textContent?.trim())).toEqual([
      SHELL_LABELS.sdkChoices.sdk,
      SHELL_LABELS.sdkChoices.own,
    ]);
    expect(choices.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('emits sdkChange for the other answer only, and hides the choice for a product on another product', async () => {
    const { fixture, sdks } = await setup({ product: 'shop', products: ['shop'], open: true, sdk: 'own' });

    fixture.componentInstance['selectSdk']('own');
    fixture.componentInstance['selectSdk']('sdk');

    expect(sdks).toEqual(['sdk']);

    fixture.componentRef.setInput('sdk', null);
    await fixture.whenStable();

    expect(document.querySelectorAll('et-menu-radio-group')).toHaveLength(1);
  });
});
