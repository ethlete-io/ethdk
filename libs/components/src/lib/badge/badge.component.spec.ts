import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import '../../test-helpers';
import { BadgeVariant } from './badge.component';
import { BADGE_IMPORTS } from './badge.imports';

@Component({
  selector: 'et-test-badge-host',
  template: `<et-badge>3 new</et-badge>`,
  imports: [BADGE_IMPORTS],
})
class BadgeDefaultHostComponent {}

@Component({
  selector: 'et-test-badge-configured-host',
  template: `<et-badge [variant]="variant()" [color]="color()">3 new</et-badge>`,
  imports: [BADGE_IMPORTS],
})
class BadgeConfiguredHostComponent {
  public variant = signal<BadgeVariant>('tonal');
  public color = signal<string | null>(null);
}

describe('BadgeComponent', () => {
  it('renders its content', () => {
    const fixture = TestBed.createComponent(BadgeDefaultHostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 new');
  });

  it('defaults to the tonal variant', () => {
    const fixture = TestBed.createComponent(BadgeDefaultHostComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;

    expect(badge.getAttribute('data-variant')).toBe('tonal');
  });

  it('reflects the variant input', () => {
    const fixture = TestBed.createComponent(BadgeConfiguredHostComponent);
    fixture.componentInstance.variant.set('outline');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;

    expect(badge.getAttribute('data-variant')).toBe('outline');
  });

  it('forwards color to the color provider', () => {
    const fixture = TestBed.createComponent(BadgeConfiguredHostComponent);
    fixture.componentInstance.color.set('brand');
    fixture.detectChanges();

    const badgeDe = fixture.debugElement.query(By.css('et-badge'));
    const provider = badgeDe.injector.get(ProvideColorDirective);

    expect(provider.color()).toBe('brand');
  });
});
