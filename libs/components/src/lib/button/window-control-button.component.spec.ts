import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import {
  WINDOW_CONTROL_BUTTON_KINDS,
  WINDOW_CONTROL_BUTTON_SIZES,
  WindowControlButtonComponent,
} from './window-control-button.component';

describe('WindowControlButtonComponent', () => {
  let fixture: ComponentFixture<WindowControlButtonComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WindowControlButtonComponent] });
    fixture = TestBed.createComponent(WindowControlButtonComponent);
    host = fixture.nativeElement;
  });

  it('has the et-window-control-button class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-window-control-button')).toBe(true);
  });

  describe('size', () => {
    it('defaults to data-size="md"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('md');
    });

    it('reflects sm size in data-size', () => {
      fixture.componentRef.setInput('size', WINDOW_CONTROL_BUTTON_SIZES.SM);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('sm');
    });

    it('reflects lg size in data-size', () => {
      fixture.componentRef.setInput('size', WINDOW_CONTROL_BUTTON_SIZES.LG);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('lg');
    });
  });

  describe('kind', () => {
    it('defaults to data-kind="default"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-kind')).toBe('default');
    });

    it('reflects close kind in data-kind', () => {
      fixture.componentRef.setInput('kind', WINDOW_CONTROL_BUTTON_KINDS.CLOSE);
      fixture.detectChanges();
      expect(host.getAttribute('data-kind')).toBe('close');
    });
  });

  describe('constants', () => {
    it('WINDOW_CONTROL_BUTTON_SIZES has SM, MD, LG', () => {
      expect(WINDOW_CONTROL_BUTTON_SIZES.SM).toBe('sm');
      expect(WINDOW_CONTROL_BUTTON_SIZES.MD).toBe('md');
      expect(WINDOW_CONTROL_BUTTON_SIZES.LG).toBe('lg');
    });

    it('WINDOW_CONTROL_BUTTON_KINDS has DEFAULT and CLOSE', () => {
      expect(WINDOW_CONTROL_BUTTON_KINDS.DEFAULT).toBe('default');
      expect(WINDOW_CONTROL_BUTTON_KINDS.CLOSE).toBe('close');
    });
  });

  describe('loading state', () => {
    it('does not render spinner by default', () => {
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).toBeNull();
    });

    it('renders spinner when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).not.toBeNull();
    });
  });

  it('renders the icon wrapper', () => {
    fixture.detectChanges();
    expect(host.querySelector('.et-window-control-button-icon')).not.toBeNull();
  });
});
