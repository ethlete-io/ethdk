import { booleanAttribute, computed, Directive, inject, InjectionToken, input, isDevMode } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS_TOKEN } from './icon-provider';

export const ICON_DIRECTIVE_TOKEN = new InjectionToken<IconDirective>('ICON_DIRECTIVE_TOKEN');

const svgColorAttributes = ['fill', 'stroke', 'stop-color', 'stop-opacity'];

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
      throw new Error(
        `Icon with name ${this.iconNameToUse} not found. Please provide a valid icon name. Available icons are: ${Object.keys(this.icons).join(', ')}`,
      );
    }

    const svg = icon.data.trim();

    if (isDevMode()) {
      if (!svg.includes('<svg')) {
        throw new Error(`Icon with name ${this.iconNameToUse()} is not a valid SVG. Please provide a valid SVG.`);
      }

      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        throw new Error(
          `Icon with name ${this.iconNameToUse()} is missing the xmlns attribute. Please add the xmlns attribute to the SVG.`,
        );
      }

      if (!svg.includes('width="100%"') || !svg.includes('height="100%"')) {
        throw new Error(
          `Icon with name ${this.iconNameToUse()} is missing width="100%" and height="100%". Please add width="100%" and height="100%" to the SVG.`,
        );
      }

      if (!this.allowHardcodedColor()) {
        for (const colorAttribute of svgColorAttributes) {
          if (svg.includes(`${colorAttribute}="`) && !svg.includes(`${colorAttribute}="currentColor"`)) {
            throw new Error(
              `Icon with name ${this.iconNameToUse()} is using a hardcoded color. Please use currentColor for the ${colorAttribute} color. If you want to use a hardcoded color, set the allowHardcodedColor input to true.`,
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
      throw new Error('No icons provided. Please provide icons using the `provideIcons` function.');
    }
  }
}
