import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideSurfaceDirective } from '@ethlete/core';
import '../../test-helpers';
import { CardVariant } from './card.component';
import { CARD_IMPORTS } from './card.imports';

@Component({
  selector: 'et-test-card-host',
  template: `<et-card>Revenue: $12,400</et-card>`,
  imports: [CARD_IMPORTS],
})
class CardDefaultHostComponent {}

@Component({
  selector: 'et-test-card-configured-host',
  template: `<et-card [variant]="variant()" [surface]="surface()">Revenue: $12,400</et-card>`,
  imports: [CARD_IMPORTS],
})
class CardConfiguredHostComponent {
  public variant = signal<CardVariant>('outlined');
  public surface = signal<string | null>(null);
}

describe('CardComponent', () => {
  it('renders its content', () => {
    const fixture = TestBed.createComponent(CardDefaultHostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Revenue: $12,400');
  });

  it('defaults to the outlined variant', () => {
    const fixture = TestBed.createComponent(CardDefaultHostComponent);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('et-card') as HTMLElement;

    expect(card.getAttribute('data-variant')).toBe('outlined');
  });

  it('reflects the variant input', () => {
    const fixture = TestBed.createComponent(CardConfiguredHostComponent);
    fixture.componentInstance.variant.set('elevated');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('et-card') as HTMLElement;

    expect(card.getAttribute('data-variant')).toBe('elevated');
  });

  it('forwards surface to the surface provider', () => {
    const fixture = TestBed.createComponent(CardConfiguredHostComponent);
    fixture.componentInstance.surface.set('dark-elevated');
    fixture.detectChanges();

    const cardDe = fixture.debugElement.query(By.css('et-card'));
    const provider = cardDe.injector.get(ProvideSurfaceDirective);

    expect(provider.surface()).toBe('dark-elevated');
  });
});
