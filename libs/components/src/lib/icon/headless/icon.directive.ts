import { booleanAttribute, computed, Directive, inject, InjectionToken, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RuntimeError } from '@ethlete/core';
import { ICON_ERROR_CODES } from './icon-errors';
import { ICONS_TOKEN } from './icon-provider';

export const ICON_DIRECTIVE_TOKEN = new InjectionToken<IconDirective>('ET_ICON_DIRECTIVE_TOKEN');

const SVG_COLOR_ATTRIBUTES = ['fill', 'stroke', 'stop-color', 'stop-opacity'];

@Directive({
  selector: '[etIcon]',
  providers: [
    {
      provide: ICON_DIRECTIVE_TOKEN,
      useExisting: IconDirective,
    },
  ],
  host: {
    '[innerHTML]': 'iconSrc()',
    'aria-hidden': 'true',
    '[class]': 'hostClasses()',
    style: 'display: flex; align-items: center; justify-content: center;',
  },
})
export class IconDirective {
  private icons = inject(ICONS_TOKEN, { optional: true });
  private sanitizer = inject(DomSanitizer);

  iconNameToUse = input.required<string>({ alias: 'etIcon' });

  allowHardcodedColor = input(false, { transform: booleanAttribute });

  iconSrc = computed(() => {
    if (!this.icons) {
      return null;
    }

    const icon = this.icons[this.iconNameToUse()];

    if (!icon) {
      throw new RuntimeError(
        ICON_ERROR_CODES.ICON_NOT_FOUND,
        `[IconDirective] Icon "${this.iconNameToUse()}" not found. Available icons: ${Object.keys(this.icons).join(', ')}.`,
      );
    }

    const svg = icon.data.trim();

    if (ngDevMode) {
      if (!svg.includes('<svg')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.INVALID_SVG,
          `[IconDirective] Icon "${this.iconNameToUse()}" is not a valid SVG. The data must contain an <svg> element.`,
        );
      }

      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.MISSING_XMLNS,
          `[IconDirective] Icon "${this.iconNameToUse()}" is missing xmlns="http://www.w3.org/2000/svg". Add the attribute to the <svg> element.`,
        );
      }

      if (!svg.includes('width="100%"') || !svg.includes('height="100%"')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.MISSING_DIMENSIONS,
          `[IconDirective] Icon "${this.iconNameToUse()}" is missing width="100%" and/or height="100%". Add both attributes to the <svg> element.`,
        );
      }

      if (!this.allowHardcodedColor()) {
        for (const colorAttribute of SVG_COLOR_ATTRIBUTES) {
          if (svg.includes(`${colorAttribute}="`) && !svg.includes(`${colorAttribute}="currentColor"`)) {
            throw new RuntimeError(
              ICON_ERROR_CODES.HARDCODED_COLOR,
              `[IconDirective] Icon "${this.iconNameToUse()}" uses a hardcoded value for "${colorAttribute}". Use currentColor instead, or set [allowHardcodedColor]="true".`,
            );
          }
        }
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });

  hostClasses = computed(() => `et-icon et-icon--${this.iconNameToUse()}`);

  constructor() {
    if (!this.icons) {
      throw new RuntimeError(
        ICON_ERROR_CODES.NO_ICONS_PROVIDED,
        '[IconDirective] No icons provided. Register icons via provideIcons() in the component or application providers.',
      );
    }
  }
}
