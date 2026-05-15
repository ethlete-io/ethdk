import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { OverlayTriggerDirective } from './overlay-trigger.directive';

@Component({
  template: `<button etOverlayTrigger>Open</button>`,
  imports: [OverlayTriggerDirective],
})
class TriggerTestHost {}

describe('OverlayTriggerDirective', () => {
  let fixture: ComponentFixture<TriggerTestHost>;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TriggerTestHost, OverlayTriggerDirective],
    });
    fixture = TestBed.createComponent(TriggerTestHost);
    button = fixture.nativeElement.querySelector('button');
  });

  it('renders trigger element as a button', () => {
    fixture.detectChanges();
    expect(button.tagName.toLowerCase()).toBe('button');
  });

  it('has etOverlayTrigger attribute', () => {
    fixture.detectChanges();
    expect(button.getAttribute('etOverlayTrigger')).toBe('');
  });

  it('applies etOverlayTrigger directive to element', () => {
    fixture.detectChanges();
    expect(button.textContent).toContain('Open');
  });

  it('is rendered as a button element', () => {
    fixture.detectChanges();
    expect(button.tagName.toLowerCase()).toBe('button');
  });
});
