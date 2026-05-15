import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { ButtonDirective } from './button.directive';

@Component({
  template: `<button
    [disabled]="disabled"
    [loading]="loading"
    [type]="type"
    [pressed]="pressed"
    [emitAriaPressed]="emitAriaPressed"
    etButton
  >
    Test
  </button>`,
  imports: [ButtonDirective],
})
class ButtonTestHost {
  disabled = false;
  emitAriaPressed = true;
  loading = false;
  type: 'button' | 'submit' | 'reset' = 'button';
  pressed = false;
}

@Component({
  template: `<a [disabled]="disabled" [loading]="loading" etButton>Test</a>`,
  imports: [ButtonDirective],
})
class AnchorTestHost {
  disabled = false;
  loading = false;
}

describe('ButtonDirective', () => {
  describe('on a <button> element', () => {
    let fixture: ComponentFixture<ButtonTestHost>;
    let button: HTMLButtonElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ButtonTestHost] });
      fixture = TestBed.createComponent(ButtonTestHost);
      button = fixture.nativeElement.querySelector('button');
    });

    describe('type attribute', () => {
      it('defaults to type="button"', () => {
        fixture.detectChanges();
        expect(button.getAttribute('type')).toBe('button');
      });

      it('reflects the type input', () => {
        fixture.componentInstance.type = 'submit';
        fixture.detectChanges();
        expect(button.getAttribute('type')).toBe('submit');
      });
    });

    describe('disabled state', () => {
      it('is not disabled by default', () => {
        fixture.detectChanges();
        expect(button.hasAttribute('disabled')).toBe(false);
        expect(button.getAttribute('aria-disabled')).toBeNull();
      });

      it('sets disabled attribute when disabled=true', () => {
        fixture.componentInstance.disabled = true;
        fixture.detectChanges();
        expect(button.hasAttribute('disabled')).toBe(true);
      });

      it('sets disabled attribute when loading=true', () => {
        fixture.componentInstance.loading = true;
        fixture.detectChanges();
        expect(button.hasAttribute('disabled')).toBe(true);
      });

      it('sets aria-disabled when inactive', () => {
        fixture.componentInstance.disabled = true;
        fixture.detectChanges();
        expect(button.getAttribute('aria-disabled')).toBe('true');
      });
    });

    describe('loading state', () => {
      it('has no data-loading attribute by default', () => {
        fixture.detectChanges();
        expect(button.getAttribute('data-loading')).toBeNull();
      });

      it('sets data-loading="true" when loading', () => {
        fixture.componentInstance.loading = true;
        fixture.detectChanges();
        expect(button.getAttribute('data-loading')).toBe('true');
      });

      it('sets aria-busy="true" when loading', () => {
        fixture.componentInstance.loading = true;
        fixture.detectChanges();
        expect(button.getAttribute('aria-busy')).toBe('true');
      });
    });

    describe('pressed state', () => {
      it('has no aria-pressed by default', () => {
        fixture.detectChanges();
        expect(button.getAttribute('aria-pressed')).toBeNull();
        expect(button.getAttribute('data-pressed')).toBeNull();
      });

      it('sets aria-pressed="true" when pressed', () => {
        fixture.componentInstance.pressed = true;
        fixture.detectChanges();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.getAttribute('data-pressed')).toBe('true');
      });

      it('keeps visual pressed state without aria-pressed when emitAriaPressed=false', () => {
        fixture.componentInstance.pressed = true;
        fixture.componentInstance.emitAriaPressed = false;
        fixture.detectChanges();
        expect(button.getAttribute('aria-pressed')).toBeNull();
        expect(button.getAttribute('data-pressed')).toBe('true');
      });
    });

    it('does not set tabindex even when inactive', () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();
      expect(button.getAttribute('tabindex')).toBeNull();
    });
  });

  describe('on an <a> element', () => {
    let fixture: ComponentFixture<AnchorTestHost>;
    let anchor: HTMLAnchorElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [AnchorTestHost] });
      fixture = TestBed.createComponent(AnchorTestHost);
      anchor = fixture.nativeElement.querySelector('a');
    });

    it('does not set a type attribute', () => {
      fixture.detectChanges();
      expect(anchor.getAttribute('type')).toBeNull();
    });

    it('does not set a disabled attribute', () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();
      expect(anchor.hasAttribute('disabled')).toBe(false);
    });

    it('sets tabindex="-1" when disabled', () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();
      expect(anchor.getAttribute('tabindex')).toBe('-1');
    });

    it('sets tabindex="-1" when loading', () => {
      fixture.componentInstance.loading = true;
      fixture.detectChanges();
      expect(anchor.getAttribute('tabindex')).toBe('-1');
    });

    it('has no tabindex when active', () => {
      fixture.detectChanges();
      expect(anchor.getAttribute('tabindex')).toBeNull();
    });

    it('still sets aria-disabled when inactive', () => {
      fixture.componentInstance.disabled = true;
      fixture.detectChanges();
      expect(anchor.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
