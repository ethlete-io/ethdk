import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { OverlayAnchorDirective } from './overlay-anchor.directive';

@Component({
  template: `<button etOverlayAnchor>Anchor</button>`,
  imports: [OverlayAnchorDirective],
})
class AnchorTestHost {}

describe('OverlayAnchorDirective', () => {
  let fixture: ComponentFixture<AnchorTestHost>;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnchorTestHost, OverlayAnchorDirective],
    });
    fixture = TestBed.createComponent(AnchorTestHost);
    button = fixture.nativeElement.querySelector('button');
  });

  it('renders anchor element as a button', () => {
    fixture.detectChanges();
    expect(button.tagName.toLowerCase()).toBe('button');
  });

  it('has etOverlayAnchor attribute', () => {
    fixture.detectChanges();
    expect(button.getAttribute('etOverlayAnchor')).toBe('');
  });

  it('has export name etOverlayAnchor', () => {
    fixture.detectChanges();
    expect(button.getAttribute('etOverlayAnchor')).toBe('');
  });
});
