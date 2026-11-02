import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TitleSearchComponent } from './title-search.component';

const render = (inputs: Partial<Record<'product' | 'part' | 'os', string>>) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(TitleSearchComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;

  return { element, button: element.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]') };
};

describe('TitleSearchComponent', () => {
  it('names the product and a long part in the field and its label', () => {
    const part = 'Checkout summary with a very long name that gets cut off';
    const { button } = render({ product: 'shop', part });

    expect(button?.textContent).toContain('shop');
    expect(button?.textContent).toContain(part);
    expect(button?.getAttribute('aria-label')).toBe(`Suchen in shop, ${part}`);
  });

  it('draws an empty field without a product or part', () => {
    const { button } = render({});

    expect(button?.getAttribute('aria-label')).toBe('Suchen in , ');
  });

  it('shows the macOS shortcut on macOS and the other one elsewhere', () => {
    const mac = render({ product: 'shop', part: 'Cart', os: 'macos' });

    expect(mac.element.querySelector('.et-kbd')?.textContent).toContain('⌘');

    TestBed.resetTestingModule();

    const linux = render({ product: 'shop', part: 'Cart', os: 'linux' });

    expect(linux.element.querySelector('.et-kbd')?.textContent).not.toContain('⌘');
  });

  it('is muted at rest and takes the full surface text colour when hovered, pressed or focused', () => {
    const { button } = render({ product: 'shop', part: 'Cart' });

    expect(button?.classList).toContain('text-et-surface-muted');
    expect([...(button?.classList ?? [])]).toEqual(
      expect.arrayContaining(['hover:text-et-surface', 'active:text-et-surface', 'focus-visible:text-et-surface']),
    );
  });

  it('does nothing on click yet', () => {
    const { button } = render({ product: 'shop', part: 'Cart' });

    expect(() => button?.click()).not.toThrow();
  });
});
