import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideIcons } from './icon-provider';
import { IconDirective } from './icon.directive';

const VALID_ICON = {
  name: 'et-test',
  data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0" stroke="currentColor"/></svg>`,
};

const VALID_ICON_2 = {
  name: 'et-test-2',
  data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0" fill="currentColor"/></svg>`,
};

@Component({
  template: `<span [etIcon]="name"></span>`,
  imports: [IconDirective],
})
class IconTestHost {
  name = VALID_ICON.name;
}

describe('IconDirective', () => {
  describe('with icons provided', () => {
    let fixture: ComponentFixture<IconTestHost>;
    let span: HTMLSpanElement;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [IconTestHost],
        providers: [provideIcons(VALID_ICON, VALID_ICON_2)],
      });
      fixture = TestBed.createComponent(IconTestHost);
      span = fixture.nativeElement.querySelector('span');
    });

    it('sets aria-hidden to true', () => {
      fixture.detectChanges();
      expect(span.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets icon-name class', () => {
      fixture.detectChanges();
      expect(span.classList.contains('et-icon--et-test')).toBe(true);
    });

    it('renders with a different icon name', () => {
      fixture.componentInstance.name = VALID_ICON_2.name;
      fixture.detectChanges();
      expect(span.classList.contains('et-icon--et-test-2')).toBe(true);
      expect(span.classList.contains('et-icon--et-test')).toBe(false);
    });

    it('renders the SVG into innerHTML', () => {
      fixture.detectChanges();
      expect(span.querySelector('svg')).toBeTruthy();
    });

    it('renders SVG for a different icon name', () => {
      fixture.componentInstance.name = VALID_ICON_2.name;
      fixture.detectChanges();
      expect(span.querySelector('svg')).toBeTruthy();
    });
  });

  describe('without icons provided', () => {
    it('throws when ICONS_TOKEN is missing', () => {
      TestBed.configureTestingModule({ imports: [IconTestHost] });
      expect(() => TestBed.createComponent(IconTestHost)).toThrow();
    });
  });

  describe('error handling (devMode)', () => {
    it('throws when icon name is not in the registry', () => {
      TestBed.configureTestingModule({
        imports: [IconTestHost],
        providers: [provideIcons(VALID_ICON)],
      });
      const fixture = TestBed.createComponent(IconTestHost);
      fixture.componentInstance.name = 'et-nonexistent';
      expect(() => fixture.detectChanges()).toThrow();
    });
  });

  describe('provideIcons', () => {
    it('throws when two icons share the same name', () => {
      const duplicate = { ...VALID_ICON };
      expect(() => provideIcons(VALID_ICON, duplicate)).toThrow();
    });
  });
});
