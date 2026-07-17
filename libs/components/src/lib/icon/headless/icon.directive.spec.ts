import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import * as iconExports from './index';
import { ET_BUILT_IN_ICON_NAMES, IconDefinition, provideIconOverrides, provideIcons } from './icon-provider';
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

    it('allows the same name across different variants', () => {
      const solid = { name: 'shield', variant: 'solid', data: VALID_ICON.data };
      const light = { name: 'shield', variant: 'light', data: VALID_ICON.data };
      expect(() => provideIcons(solid, light)).not.toThrow();
    });

    it('throws when the same name/variant pair is registered twice', () => {
      const solid = { name: 'shield', variant: 'solid', data: VALID_ICON.data };
      expect(() => provideIcons(solid, { ...solid })).toThrow();
    });
  });

  describe('provideIconOverrides', () => {
    // Distinct viewBox lets a test tell which icon `data` actually rendered.
    const OVERRIDE_TEST = {
      name: 'et-test',
      data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99 99"><path d="M0 0" stroke="currentColor"/></svg>`,
    };
    const ADDED_ICON = {
      name: 'et-added',
      data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 77 77"><path d="M0 0" stroke="currentColor"/></svg>`,
    };

    // Self-registers its icons at the component injector, mirroring how real components do it.
    @Component({
      template: `<span [etIcon]="name"></span>`,
      imports: [IconDirective],
      providers: [provideIcons(VALID_ICON, VALID_ICON_2)],
    })
    class SelfRegisteringHost {
      name = 'et-test';
    }

    const render = (name: string) => {
      const fixture = TestBed.createComponent(SelfRegisteringHost);
      fixture.componentInstance.name = name;
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('span').querySelector('svg') as SVGSVGElement | null;
    };

    it('lets a root override win over a component self-registered icon of the same name', () => {
      TestBed.configureTestingModule({
        imports: [SelfRegisteringHost],
        providers: [provideIconOverrides(OVERRIDE_TEST)],
      });
      expect(render('et-test')?.getAttribute('viewBox')).toBe('0 0 99 99');
    });

    it('leaves non-overridden names on their component default', () => {
      TestBed.configureTestingModule({
        imports: [SelfRegisteringHost],
        providers: [provideIconOverrides(OVERRIDE_TEST)],
      });
      expect(render('et-test-2')?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('makes a brand-new override name resolvable from the directive', () => {
      TestBed.configureTestingModule({
        imports: [SelfRegisteringHost],
        providers: [provideIconOverrides(ADDED_ICON)],
      });
      expect(render('et-added')?.getAttribute('viewBox')).toBe('0 0 77 77');
    });

    it('throws when two overrides share the same name/variant', () => {
      expect(() => provideIconOverrides(OVERRIDE_TEST, { ...OVERRIDE_TEST })).toThrow();
    });
  });

  describe('ET_BUILT_IN_ICON_NAMES', () => {
    it('matches the names of every shipped built-in icon constant (drift guard)', () => {
      const isIconDefinition = (value: unknown): value is IconDefinition =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as IconDefinition).name === 'string' &&
        typeof (value as IconDefinition).data === 'string';

      const shipped = Object.values(iconExports)
        .filter(isIconDefinition)
        .map((icon) => icon.name)
        .filter((name) => name.startsWith('et-'));

      expect([...new Set(shipped)].sort()).toEqual([...ET_BUILT_IN_ICON_NAMES].sort());
    });
  });

  describe('variants', () => {
    const SHIELD_SOLID = { name: 'shield', variant: 'solid', data: VALID_ICON.data };
    const SHIELD_LIGHT = { name: 'shield', variant: 'light', data: VALID_ICON_2.data };

    @Component({
      template: `<span [etIcon]="name" [variant]="variant"></span>`,
      imports: [IconDirective],
    })
    class VariantHost {
      name = 'shield';
      variant: string | undefined = undefined;
    }

    let fixture: ComponentFixture<VariantHost>;
    let span: HTMLSpanElement;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [VariantHost],
        providers: [provideIcons(SHIELD_SOLID, SHIELD_LIGHT)],
      });
      fixture = TestBed.createComponent(VariantHost);
      span = fixture.nativeElement.querySelector('span');
    });

    it('falls back to the solid variant when none is given', () => {
      fixture.detectChanges();
      expect(span.querySelector('svg')).toBeTruthy();
      expect(span.classList.contains('et-icon--shield')).toBe(true);
    });

    it('resolves the requested variant and reflects it in the host class', () => {
      fixture.componentInstance.variant = 'light';
      fixture.detectChanges();
      expect(span.classList.contains('et-icon--shield--light')).toBe(true);
    });

    it('throws when the requested variant is not registered', () => {
      fixture.componentInstance.variant = 'thin';
      expect(() => fixture.detectChanges()).toThrow();
    });
  });
});
