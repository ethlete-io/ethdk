import { booleanAttribute, computed, Directive, inject, InjectionToken, input, InputSignal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RuntimeError } from '@ethlete/core';
import { ICON_ERROR_CODES } from './icon-errors';
import {
  DEFAULT_ICON_VARIANT,
  iconRegistryKey,
  ICONS_TOKEN,
  RegisteredIconName,
  RegisteredIconVariant,
} from './icon-provider';

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

  public iconNameToUse: InputSignal<RegisteredIconName> = input.required<RegisteredIconName>({ alias: 'etIcon' });

  public variant: InputSignal<RegisteredIconVariant | undefined> = input<RegisteredIconVariant | undefined>(undefined);

  public allowHardcodedColor = input(false, { transform: booleanAttribute });

  private resolvedIcon = computed(() => {
    if (!this.icons) {
      return null;
    }

    const name = this.iconNameToUse();
    const variant = this.variant();

    // Explicit variant → exact match only. Otherwise prefer a variant-less registration
    // (the built-in et-* icons) before falling back to the default `solid` variant.
    const candidateKeys = variant
      ? [iconRegistryKey(name, variant)]
      : [iconRegistryKey(name), iconRegistryKey(name, DEFAULT_ICON_VARIANT)];

    for (const key of candidateKeys) {
      const icon = this.icons[key];

      if (icon) {
        return icon;
      }
    }

    throw new RuntimeError(
      ICON_ERROR_CODES.ICON_NOT_FOUND,
      `[IconDirective] Icon "${name}"${
        variant ? ` (variant "${variant}")` : ''
      } not found. Available icons: ${Object.keys(this.icons).join(', ')}.`,
    );
  });

  public iconSrc = computed(() => {
    const icon = this.resolvedIcon();

    if (!icon) {
      return null;
    }

    const svg = icon.data.trim();
    const label = iconRegistryKey(icon.name, icon.variant);

    if (ngDevMode) {
      if (!svg.includes('<svg')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.INVALID_SVG,
          `[IconDirective] Icon "${label}" is not a valid SVG. The data must contain an <svg> element.`,
        );
      }

      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.MISSING_XMLNS,
          `[IconDirective] Icon "${label}" is missing xmlns="http://www.w3.org/2000/svg". Add the attribute to the <svg> element.`,
        );
      }

      if (!svg.includes('width="100%"') || !svg.includes('height="100%"')) {
        throw new RuntimeError(
          ICON_ERROR_CODES.MISSING_DIMENSIONS,
          `[IconDirective] Icon "${label}" is missing width="100%" and/or height="100%". Add both attributes to the <svg> element.`,
        );
      }

      if (!this.allowHardcodedColor()) {
        for (const colorAttribute of SVG_COLOR_ATTRIBUTES) {
          for (const [, value] of svg.matchAll(new RegExp(`\\b${colorAttribute}="([^"]*)"`, 'g'))) {
            if (value !== 'currentColor' && value !== 'none') {
              throw new RuntimeError(
                ICON_ERROR_CODES.HARDCODED_COLOR,
                `[IconDirective] Icon "${label}" uses the hardcoded value "${value}" for "${colorAttribute}". Use currentColor instead, or set [allowHardcodedColor]="true".`,
              );
            }
          }
        }
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(svg);
  });

  public hostClasses = computed(() => {
    const name = this.iconNameToUse();
    const variant = this.variant();
    const base = `et-icon et-icon--${name}`;

    return variant ? `${base} et-icon--${name}--${variant}` : base;
  });

  constructor() {
    if (!this.icons) {
      throw new RuntimeError(
        ICON_ERROR_CODES.NO_ICONS_PROVIDED,
        '[IconDirective] No icons provided. Register icons via provideIcons() in the component or application providers.',
      );
    }
  }
}
