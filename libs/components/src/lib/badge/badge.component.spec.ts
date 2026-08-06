import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import '../../test-helpers';
import { CHECK_ICON, IconDirective, provideIcons } from '../icon';
import { BadgeIconAlignment, BadgeSize, BadgeVariant } from './badge.component';
import { BADGE_IMPORTS } from './badge.imports';

@Component({
  selector: 'et-test-badge-host',
  template: `<et-badge>3 new</et-badge>`,
  imports: [BADGE_IMPORTS],
})
class BadgeDefaultHostComponent {}

@Component({
  selector: 'et-test-badge-configured-host',
  template: `<et-badge [variant]="variant()" [color]="color()" [size]="size()">3 new</et-badge>`,
  imports: [BADGE_IMPORTS],
})
class BadgeConfiguredHostComponent {
  public variant = signal<BadgeVariant>('tonal');
  public color = signal<string | null>(null);
  public size = signal<BadgeSize>('md');
}

@Component({
  selector: 'et-test-badge-icon-host',
  template: `
    <et-badge [iconAlignment]="iconAlignment()">
      <i etIcon="et-check"></i>
      Verified
    </et-badge>
  `,
  imports: [BADGE_IMPORTS, IconDirective],
  providers: [provideIcons(CHECK_ICON)],
})
class BadgeIconHostComponent {
  public iconAlignment = signal<BadgeIconAlignment>('start');
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

  it('defaults to the md size', () => {
    const fixture = TestBed.createComponent(BadgeDefaultHostComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;

    expect(badge.getAttribute('data-size')).toBe('md');
  });

  it('reflects the size input', () => {
    const fixture = TestBed.createComponent(BadgeConfiguredHostComponent);
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;

    expect(badge.getAttribute('data-size')).toBe('lg');
  });

  it('projects an etIcon into the icon slot, before the label', () => {
    const fixture = TestBed.createComponent(BadgeIconHostComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;
    const slot = badge.querySelector('.et-badge-icon') as HTMLElement;

    expect(slot.querySelector('.et-icon')).toBeTruthy();
    expect(badge.textContent).toContain('Verified');
    expect(badge.firstElementChild).toBe(slot);
  });

  it('moves the icon slot after the label when iconAlignment is end', () => {
    const fixture = TestBed.createComponent(BadgeIconHostComponent);
    fixture.componentInstance.iconAlignment.set('end');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('et-badge') as HTMLElement;
    const slot = badge.querySelector('.et-badge-icon') as HTMLElement;

    expect(slot.querySelector('.et-icon')).toBeTruthy();
    expect(badge.lastElementChild).toBe(slot);
  });
});
