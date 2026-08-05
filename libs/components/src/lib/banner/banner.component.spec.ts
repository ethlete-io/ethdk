import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorTheme, ProvideColorDirective, provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { BannerComponent, BannerType } from './banner.component';
import { BANNER_IMPORTS } from './banner.imports';

const COLOR_THEMES: ColorTheme[] = [
  { name: 'danger', type: 'error', primary: { color: { default: '220 38 38' }, onColor: { default: '255 255 255' } } },
  {
    name: 'sunshine',
    type: 'warning',
    primary: { color: { default: '234 179 8' }, onColor: { default: '0 0 0' } },
  },
  { name: 'grass', type: 'success', primary: { color: { default: '22 163 74' }, onColor: { default: '255 255 255' } } },
];

@Component({
  selector: 'et-test-banner-host',
  template: `
    <et-banner
      [heading]="heading()"
      [description]="description()"
      [type]="type()"
      [dismissible]="dismissible()"
      (dismiss)="dismissCount = dismissCount + 1"
    >
      <button etBannerAction type="button">Retry</button>
    </et-banner>
  `,
  imports: [BANNER_IMPORTS],
})
class BannerHostComponent {
  public banner = viewChild(BannerComponent, { read: ProvideColorDirective });

  public heading = signal<string | undefined>(undefined);
  public description = signal<string | undefined>(undefined);
  public type = signal<BannerType>('info');
  public dismissible = signal(false);
  public dismissCount = 0;
}

const createHost = (): ComponentFixture<BannerHostComponent> => {
  TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  const fixture = TestBed.createComponent(BannerHostComponent);
  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<BannerHostComponent>) => fixture.nativeElement as HTMLElement;

describe('BannerComponent', () => {
  it('renders the heading and description', () => {
    const fixture = createHost();
    fixture.componentInstance.heading.set('Update available');
    fixture.componentInstance.description.set('Version 2.1 is ready to install.');
    fixture.detectChanges();

    expect(host(fixture).querySelector('.et-banner-heading')?.textContent).toBe('Update available');
    expect(host(fixture).querySelector('.et-banner-description')?.textContent).toBe('Version 2.1 is ready to install.');
  });

  it('projects action content', () => {
    const fixture = createHost();

    expect(host(fixture).querySelector('[etBannerAction]')?.textContent).toBe('Retry');
  });

  it('defaults to type "info" with role="status" and no forced color', () => {
    const fixture = createHost();

    expect(host(fixture).querySelector('et-banner')?.getAttribute('role')).toBe('status');
    expect(fixture.componentInstance.banner()?.effectiveColor()).toBeUndefined();
  });

  it('does not require warning/success themes to be registered for an info banner', () => {
    TestBed.configureTestingModule({ providers: [] });
    const fixture = TestBed.createComponent(BannerHostComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('forces the registered error theme and role="alert" for type "error"', () => {
    const fixture = createHost();
    fixture.componentInstance.type.set('error');
    fixture.detectChanges();

    expect(host(fixture).querySelector('et-banner')?.getAttribute('role')).toBe('alert');
    expect((fixture.componentInstance.banner()?.effectiveColor() as ColorTheme)?.name).toBe('danger');
  });

  it('forces the registered warning theme and role="alert" for type "warning"', () => {
    const fixture = createHost();
    fixture.componentInstance.type.set('warning');
    fixture.detectChanges();

    expect(host(fixture).querySelector('et-banner')?.getAttribute('role')).toBe('alert');
    expect((fixture.componentInstance.banner()?.effectiveColor() as ColorTheme)?.name).toBe('sunshine');
  });

  it('forces the registered success theme and role="status" for type "success"', () => {
    const fixture = createHost();
    fixture.componentInstance.type.set('success');
    fixture.detectChanges();

    expect(host(fixture).querySelector('et-banner')?.getAttribute('role')).toBe('status');
    expect((fixture.componentInstance.banner()?.effectiveColor() as ColorTheme)?.name).toBe('grass');
  });

  it('renders no dismiss button unless dismissible', () => {
    const fixture = createHost();

    expect(host(fixture).querySelector('.et-banner-dismiss-btn')).toBeNull();
  });

  it('emits dismissed when the dismiss button is clicked', () => {
    const fixture = createHost();
    fixture.componentInstance.dismissible.set(true);
    fixture.detectChanges();

    const button = host(fixture).querySelector<HTMLButtonElement>('.et-banner-dismiss-btn');

    expect(button?.getAttribute('aria-label')).toBe('Dismiss');

    button?.click();

    expect(fixture.componentInstance.dismissCount).toBe(1);
  });
});
