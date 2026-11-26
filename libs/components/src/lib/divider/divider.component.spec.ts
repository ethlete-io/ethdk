import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { DividerOrientation } from './divider.component';
import { DIVIDER_IMPORTS } from './divider.imports';

@Component({
  selector: 'et-test-divider-host',
  template: `<et-divider />`,
  imports: [DIVIDER_IMPORTS],
})
class DividerDefaultHostComponent {}

@Component({
  selector: 'et-test-divider-configured-host',
  template: `<et-divider [orientation]="orientation()" [decorative]="decorative()" />`,
  imports: [DIVIDER_IMPORTS],
})
class DividerConfiguredHostComponent {
  public orientation = signal<DividerOrientation>('horizontal');
  public decorative = signal(false);
}

const dividerOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('et-divider') as HTMLElement;

describe('DividerComponent', () => {
  it('defaults to a horizontal separator', () => {
    const fixture = TestBed.createComponent(DividerDefaultHostComponent);
    fixture.detectChanges();

    const divider = dividerOf(fixture);

    expect(divider.getAttribute('data-orientation')).toBe('horizontal');
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(divider.getAttribute('aria-hidden')).toBeNull();
  });

  it('reflects the orientation input', () => {
    const fixture = TestBed.createComponent(DividerConfiguredHostComponent);
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();

    const divider = dividerOf(fixture);

    expect(divider.getAttribute('data-orientation')).toBe('vertical');
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('drops its semantics when decorative', () => {
    const fixture = TestBed.createComponent(DividerConfiguredHostComponent);
    fixture.componentInstance.decorative.set(true);
    fixture.detectChanges();

    const divider = dividerOf(fixture);

    expect(divider.getAttribute('role')).toBe('presentation');
    expect(divider.getAttribute('aria-hidden')).toBe('true');
    expect(divider.getAttribute('aria-orientation')).toBeNull();
  });
});
