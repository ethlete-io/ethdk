import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { FocusRingDirective } from './focus-ring.directive';

@Component({
  template: `<button [disabled]="disabled" etFocusRing>Test</button>`,
  imports: [FocusRingDirective],
})
class FocusRingTestHost {
  disabled = false;
}

describe('FocusRingDirective', () => {
  let fixture: ComponentFixture<FocusRingTestHost>;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FocusRingTestHost] });
    fixture = TestBed.createComponent(FocusRingTestHost);
    button = fixture.nativeElement.querySelector('button');
  });

  describe('et-focus-ring class', () => {
    it('adds the class when not disabled', () => {
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring')).toBe(true);
    });

    it('omits the class when disabled', () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring')).toBe(false);
    });
  });

  describe('et-focus-ring--active class', () => {
    it('is absent by default', () => {
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring--active')).toBe(false);
    });

    it('is added on keydown Enter', () => {
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring--active')).toBe(true);
    });

    it('is removed on keyup Enter', () => {
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring--active')).toBe(false);
    });

    it('is added on keydown Space', () => {
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring--active')).toBe(true);
    });

    it('is removed on keyup Space', () => {
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();
      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      fixture.detectChanges();
      expect(button.classList.contains('et-focus-ring--active')).toBe(false);
    });
  });
});
