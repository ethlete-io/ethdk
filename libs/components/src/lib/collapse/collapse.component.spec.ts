import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { COLLAPSE_IMPORTS } from './collapse.imports';

@Component({
  selector: 'et-test-collapse-host',
  template: `<et-collapse [open]="open()"><p>Content</p></et-collapse>`,
  imports: [COLLAPSE_IMPORTS],
})
class CollapseHostComponent {
  public open = signal(false);
}

const collapseOf = (fixture: { nativeElement: HTMLElement }) =>
  fixture.nativeElement.querySelector('et-collapse') as HTMLElement;

describe('CollapseComponent', () => {
  it('is closed and inert by default', () => {
    const fixture = TestBed.createComponent(CollapseHostComponent);
    fixture.detectChanges();

    const collapse = collapseOf(fixture);

    expect(collapse.hasAttribute('data-open')).toBe(false);
    expect(collapse.hasAttribute('inert')).toBe(true);
    expect(collapse.querySelector('.et-collapse-clip p')).not.toBeNull();
  });

  it('toggles data-open and inert with the open input', () => {
    const fixture = TestBed.createComponent(CollapseHostComponent);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const collapse = collapseOf(fixture);

    expect(collapse.hasAttribute('data-open')).toBe(true);
    expect(collapse.hasAttribute('inert')).toBe(false);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(collapse.hasAttribute('data-open')).toBe(false);
    expect(collapse.hasAttribute('inert')).toBe(true);
  });

  it('does not set data-can-animate on the first render', () => {
    const fixture = TestBed.createComponent(CollapseHostComponent);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(collapseOf(fixture).hasAttribute('data-can-animate')).toBe(false);
  });
});
